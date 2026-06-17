import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { evaluateExecutionPolicy } from '../services/executionPolicy.js'
import { betaAccessValid } from '../services/betaAccess.js'

const schema = z.object({
  intent: z.string().min(3).max(500),
  endpointId: z.string().uuid(),
  budget: z.number().positive().max(10),
  mode: z.literal('simulation').default('simulation'),
})

export type ExecutionEndpoint = {
  id: string
  name: string
  url: string
  priceUsdc: number
  isActive: boolean
}

export type ExecuteRouteDependencies = {
  config: {
    simulationEnabled: boolean
    liveExecutionEnabled: boolean
    betaExecutionKey?: string
    maxBudgetUsdc: number
    endpointAllowlist: ReadonlySet<string>
  }
  findEndpoint: (id: string) => Promise<ExecutionEndpoint | undefined>
  createRequestId?: () => string
  logPolicy?: (details: Record<string, unknown>) => void
}

export function createExecuteRoute(dependencies: ExecuteRouteDependencies) {
  const { config, findEndpoint } = dependencies
  const createRequestId = dependencies.createRequestId ?? randomUUID
  const logPolicy =
    dependencies.logPolicy ??
    ((details) => console.info('execution policy evaluated', details))

  return new Hono().post('/', async (c) => {
    const requestId = createRequestId()
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

    if (!config.simulationEnabled) {
      return c.json(
        {
          success: false,
          mode: 'simulation',
          requestId,
          error: 'execution_simulation_disabled',
          liveExecutionEnabled: config.liveExecutionEnabled,
          paymentSent: false,
        },
        503,
      )
    }

    if (!config.betaExecutionKey) {
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

    if (!betaAccessValid(c.req.header('x-beta-key'), config.betaExecutionKey)) {
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

    const endpoint = await findEndpoint(parsed.data.endpointId)

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
        simulationEnabled: config.simulationEnabled,
        betaAccessConfigured: Boolean(config.betaExecutionKey),
        betaAccessValid: true,
        maxBudgetUsdc: config.maxBudgetUsdc,
        endpointAllowlist: config.endpointAllowlist,
      },
    )

    logPolicy({
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
        maxBudgetUsdc: config.maxBudgetUsdc,
        simulationPassed: policy.simulationPassed,
        liveExecutionEnabled: config.liveExecutionEnabled,
        blockedBy: policy.blockedBy,
        paymentSent: false,
        note: 'Policy simulation only. This endpoint never sends payment or calls the upstream API.',
      },
      policy.simulationPassed ? 200 : 403,
    )
  })
}
