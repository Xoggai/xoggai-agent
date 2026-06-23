import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env.js'
import type { BetaAccessContext } from '../services/betaAccess.js'
import { configuredBetaAccess } from '../services/configuredBetaAccess.js'
import {
  type BetaExecutionUsage,
  getBetaExecutionUsage,
  listBetaExecutionTickets,
} from '../services/paymentPrepareTickets.js'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type BetaExecutionsDependencies = {
  resolveAccess: (
    candidate: string | undefined,
  ) => BetaAccessContext | undefined
  getUsage: (input: {
    betaKeyId: string
    since: Date
  }) => Promise<BetaExecutionUsage>
  listExecutions: (input: {
    betaKeyId: string
    limit: number
  }) => Promise<unknown[]>
  executionEnabled: {
    prepare: boolean
    signing: boolean
    verification: boolean
    upstream: boolean
  }
}

export function createBetaExecutionsRoute(
  dependencies: BetaExecutionsDependencies,
) {
  return new Hono().get('/', async (c) => {
    c.header('Cache-Control', 'no-store')
    c.header('Pragma', 'no-cache')

    const access = dependencies.resolveAccess(c.req.header('x-beta-key'))
    if (!access) {
      return c.json(
        {
          success: false,
          error: 'invalid_beta_access',
        },
        401,
      )
    }

    const parsed = querySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'invalid_request',
        },
        400,
      )
    }

    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const [usage, executions] = await Promise.all([
      dependencies.getUsage({ betaKeyId: access.id, since }),
      dependencies.listExecutions({
        betaKeyId: access.id,
        limit: parsed.data.limit,
      }),
    ])

    return c.json({
      success: true,
      betaAccess: {
        id: access.id,
        label: access.label,
        enabled: access.enabled,
      },
      limits: {
        maxBudgetUsdc: access.maxBudgetUsdc,
        dailyRequestLimit: access.dailyRequestLimit,
        dailyBudgetUsdc: access.dailyBudgetUsdc,
      },
      usage: {
        ...usage,
        since: since.toISOString(),
        remainingRequests: Math.max(
          access.dailyRequestLimit - usage.requestCount,
          0,
        ),
        remainingBudgetUsdc: Math.max(
          access.dailyBudgetUsdc - usage.budgetUsdc,
          0,
        ),
      },
      executions,
      executionEnabled: dependencies.executionEnabled,
    })
  })
}

export const betaExecutionsRoute = createBetaExecutionsRoute({
  resolveAccess: configuredBetaAccess,
  getUsage: getBetaExecutionUsage,
  listExecutions: listBetaExecutionTickets,
  executionEnabled: {
    prepare: env.X402_PREPARE_ENABLED,
    signing: env.X402_SIGNING_ENABLED,
    verification: env.X402_VERIFY_ENABLED,
    upstream: env.X402_UPSTREAM_EXECUTION_ENABLED,
  },
})
