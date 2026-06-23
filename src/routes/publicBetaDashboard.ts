import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env.js'
import {
  authenticatePublicBetaSession,
  bearerToken,
} from '../services/publicBetaAuth.js'
import {
  createPublicBetaExecutionRequest,
  listPublicBetaExecutionRequests,
  PublicBetaIdempotencyError,
  PublicBetaQuotaError,
  publicBetaRequestUsage,
  recordPublicBetaAuditEvent,
  resolvePublicBetaIdempotency,
} from '../services/publicBetaRequests.js'
import { intentRouter } from '../services/intentRouter.js'
import {
  consumeIdentityRateLimit,
  hashAbuseIdentifier,
  normalizeIdempotencyKey,
} from '../services/abuseProtection.js'

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
      paymentExecution: 'operator-approved-base-sepolia',
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
    const idempotencyKey = normalizeIdempotencyKey(
      c.req.header('idempotency-key'),
    )
    if (!idempotencyKey) {
      return c.json(
        { success: false, error: 'invalid_idempotency_key' },
        400,
      )
    }
    let rateLimit
    try {
      rateLimit = await consumeIdentityRateLimit({
        scope: 'public-beta-request',
        identity: user.id,
        limit: env.PUBLIC_BETA_RATE_LIMIT_MAX,
        windowMs: env.PUBLIC_BETA_RATE_LIMIT_WINDOW_MS,
      })
    } catch {
      return c.json(
        { success: false, error: 'abuse_protection_unavailable' },
        503,
      )
    }
    c.header('X-RateLimit-Limit', String(rateLimit.limit))
    c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
    c.header('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)))
    if (!rateLimit.allowed) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'identity_rate_limit_exceeded',
          identityHash: rateLimit.identityHash,
          scope: 'public-beta-request',
          ts: new Date().toISOString(),
        }),
      )
      await recordPublicBetaAuditEvent({
        userId: user.id,
        actorId: user.id,
        action: 'IDENTITY_RATE_LIMIT_EXCEEDED',
        requestId: c.res.headers.get('X-Request-Id') ?? undefined,
        severity: 'SECURITY',
        outcome: 'DENIED',
        sourceHash: rateLimit.identityHash,
        metadata: { scope: 'public-beta-request' },
      })
      return c.json({ success: false, error: 'rate_limit_exceeded' }, 429)
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
    try {
      const existing = await resolvePublicBetaIdempotency({
        userId: user.id,
        idempotencyKey,
        ...parsed.data,
      })
      if (existing) {
        await recordPublicBetaAuditEvent({
          userId: user.id,
          actorId: user.id,
          action: 'EXECUTION_REQUEST_REPLAYED',
          targetId: existing.id,
          requestId: c.res.headers.get('X-Request-Id') ?? undefined,
          outcome: 'REPLAYED',
          sourceHash: rateLimit.identityHash,
        })
        return c.json({
          success: true,
          request: existing,
          idempotentReplay: true,
          paymentSent: false,
          nextStep: 'operator_review',
        })
      }
    } catch (error) {
      if (error instanceof PublicBetaIdempotencyError) {
        return c.json({ success: false, error: error.code }, 409)
      }
      throw error
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
      const result = await createPublicBetaExecutionRequest({
        userId: user.id,
        intent: parsed.data.intent,
        budgetUsdc: parsed.data.budgetUsdc,
        dailyRequestLimit: user.dailyRequestLimit,
        dailyBudgetUsdc: user.dailyBudgetUsdc,
        idempotencyKey,
        requestTtlSeconds: env.PUBLIC_BETA_REQUEST_TTL_SECONDS,
        requestId: c.res.headers.get('X-Request-Id') ?? undefined,
        sourceHash: hashAbuseIdentifier(
          c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
        ),
        endpoint: {
          id: preview.endpoint.id,
          name: preview.endpoint.name,
          url: preview.endpoint.url,
          priceUsdc: preview.endpoint.priceUsdc,
        },
      })
      request = result.request
    } catch (error) {
      if (error instanceof PublicBetaQuotaError) {
        return c.json({ success: false, error: error.code }, 429)
      }
      if (error instanceof PublicBetaIdempotencyError) {
        return c.json({ success: false, error: error.code }, 409)
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
