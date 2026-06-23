import { Hono } from 'hono'
import { z } from 'zod'
import {
  authenticatePublicBetaSession,
  bearerToken,
} from '../services/publicBetaAuth.js'
import {
  createPublicBetaExecutionRequest,
  listPublicBetaExecutionRequests,
  PublicBetaQuotaError,
  publicBetaRequestUsage,
} from '../services/publicBetaRequests.js'
import { intentRouter } from '../services/intentRouter.js'

const requestSchema = z.object({
  intent: z.string().trim().min(3).max(500),
  budgetUsdc: z.number().positive().max(0.005),
})
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

async function sessionUser(c: {
  req: { header: (name: string) => string | undefined }
}) {
  const token = bearerToken(c.req.header('authorization'))
  return token ? authenticatePublicBetaSession(token) : undefined
}

export const publicBetaDashboardRoute = new Hono()
  .get('/me', async (c) => {
    c.header('Cache-Control', 'no-store')
    const user = await sessionUser(c)
    if (!user) return c.json({ success: false, error: 'invalid_session' }, 401)
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const usage = await publicBetaRequestUsage({ userId: user.id, since })
    return c.json({
      success: true,
      user,
      usage: {
        ...usage,
        since: since.toISOString(),
        remainingRequests: Math.max(
          user.dailyRequestLimit - usage.requestCount,
          0,
        ),
        remainingBudgetUsdc: Math.max(
          user.dailyBudgetUsdc - usage.budgetUsdc,
          0,
        ),
      },
      paymentExecution: 'operator-approved',
    })
  })
  .get('/requests', async (c) => {
    c.header('Cache-Control', 'no-store')
    const user = await sessionUser(c)
    if (!user) return c.json({ success: false, error: 'invalid_session' }, 401)
    const parsed = listSchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    const requests = await listPublicBetaExecutionRequests({
      userId: user.id,
      limit: parsed.data.limit,
    })
    return c.json({ success: true, requests })
  })
  .post('/requests', async (c) => {
    c.header('Cache-Control', 'no-store')
    const user = await sessionUser(c)
    if (!user) return c.json({ success: false, error: 'invalid_session' }, 401)
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    if (parsed.data.budgetUsdc > user.maxBudgetUsdc) {
      return c.json(
        {
          success: false,
          error: 'user_budget_exceeded',
          maxBudgetUsdc: user.maxBudgetUsdc,
        },
        403,
      )
    }
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const usage = await publicBetaRequestUsage({ userId: user.id, since })
    if (usage.requestCount >= user.dailyRequestLimit) {
      return c.json(
        { success: false, error: 'daily_request_limit_exceeded' },
        429,
      )
    }
    if (
      usage.budgetUsdc + parsed.data.budgetUsdc >
      user.dailyBudgetUsdc
    ) {
      return c.json(
        { success: false, error: 'daily_budget_exceeded' },
        429,
      )
    }

    const preview = await intentRouter({
      q: parsed.data.intent,
      budget: parsed.data.budgetUsdc,
      dry: true,
    })
    if (!preview.success || !preview.endpoint) {
      return c.json(
        {
          success: false,
          error: 'error' in preview ? preview.error : 'no_endpoint_found',
          preview,
        },
        422,
      )
    }
    let request
    try {
      request = await createPublicBetaExecutionRequest({
        userId: user.id,
        intent: parsed.data.intent,
        budgetUsdc: parsed.data.budgetUsdc,
        dailyRequestLimit: user.dailyRequestLimit,
        dailyBudgetUsdc: user.dailyBudgetUsdc,
        endpoint: {
          id: preview.endpoint.id,
          name: preview.endpoint.name,
          url: preview.endpoint.url,
          priceUsdc: preview.endpoint.priceUsdc,
        },
      })
    } catch (error) {
      if (error instanceof PublicBetaQuotaError) {
        return c.json({ success: false, error: error.code }, 429)
      }
      throw error
    }
    return c.json(
      {
        success: true,
        request,
        preview,
        paymentSent: false,
        nextStep: 'operator_review',
      },
      201,
    )
  })
