import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { endpoints } from '../db/schema.js'
import { env, executionEndpointAllowlist } from '../env.js'
import { evaluateExecutionPolicy } from '../services/executionPolicy.js'

const schema = z.object({
  intent: z.string().min(3).max(500),
  endpointId: z.string().uuid(),
  budget: z.number().positive().max(10),
  mode: z.literal('simulation').default('simulation'),
})

function betaAccessValid(candidate: string | undefined) {
  if (!candidate || !env.BETA_EXECUTION_KEY) return false

  const actual = Buffer.from(candidate)
  const expected = Buffer.from(env.BETA_EXECUTION_KEY)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export const executeRoute = new Hono().post('/', async (c) => {
  const requestId = crypto.randomUUID()
  const parsed = schema.safeParse(await c.req.json().catch(() => null))

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        mode: 'simulation',
        requestId,
        error: 'invalid_request',
        detail: parsed.error.flatten(),
        paymentSent: false,
      },
      400,
    )
  }

  if (!env.EXECUTION_SIMULATION_ENABLED) {
    return c.json(
      {
        success: false,
        mode: 'simulation',
        requestId,
        error: 'execution_simulation_disabled',
        liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
        paymentSent: false,
      },
      503,
    )
  }

  if (!env.BETA_EXECUTION_KEY) {
    return c.json(
      {
        success: false,
        mode: 'simulation',
        requestId,
        error: 'beta_access_not_configured',
        paymentSent: false,
      },
      503,
    )
  }

  if (!betaAccessValid(c.req.header('x-beta-key'))) {
    return c.json(
      {
        success: false,
        mode: 'simulation',
        requestId,
        error: 'invalid_beta_access',
        paymentSent: false,
      },
      401,
    )
  }

  const [endpoint] = await db
    .select({
      id: endpoints.id,
      name: endpoints.name,
      url: endpoints.url,
      priceUsdc: endpoints.priceUsdc,
      isActive: endpoints.isActive,
    })
    .from(endpoints)
    .where(eq(endpoints.id, parsed.data.endpointId))
    .limit(1)

  if (!endpoint || !endpoint.isActive) {
    return c.json(
      {
        success: false,
        mode: 'simulation',
        requestId,
        error: 'unknown_endpoint',
        paymentSent: false,
      },
      404,
    )
  }

  const policy = evaluateExecutionPolicy(
    {
      endpointId: endpoint.id,
      endpointPriceUsdc: endpoint.priceUsdc,
      budgetUsdc: parsed.data.budget,
    },
    {
      simulationEnabled: env.EXECUTION_SIMULATION_ENABLED,
      betaAccessConfigured: Boolean(env.BETA_EXECUTION_KEY),
      betaAccessValid: true,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      endpointAllowlist: executionEndpointAllowlist(),
    },
  )

  console.info('execution policy evaluated', {
    requestId,
    mode: 'simulation',
    endpointId: endpoint.id,
    budgetUsdc: parsed.data.budget,
    endpointPriceUsdc: endpoint.priceUsdc,
    simulationPassed: policy.simulationPassed,
    blockedBy: policy.blockedBy,
  })

  return c.json(
    {
      success: policy.simulationPassed,
      mode: 'simulation',
      requestId,
      intent: parsed.data.intent,
      endpoint: {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        priceUsdc: endpoint.priceUsdc,
      },
      budgetUsdc: parsed.data.budget,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      simulationPassed: policy.simulationPassed,
      liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
      blockedBy: policy.blockedBy,
      paymentSent: false,
      note: 'Policy simulation only. This endpoint never sends payment or calls the upstream API.',
    },
    policy.simulationPassed ? 200 : 403,
  )
})
