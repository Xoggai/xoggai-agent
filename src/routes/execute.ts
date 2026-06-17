import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { endpoints } from '../db/schema.js'
import { env, executionEndpointAllowlist } from '../env.js'
import { createExecuteRoute } from './executeRoute.js'

export const executeRoute = createExecuteRoute({
  config: {
    simulationEnabled: env.EXECUTION_SIMULATION_ENABLED,
    liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
    betaExecutionKey: env.BETA_EXECUTION_KEY,
    maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
    endpointAllowlist: executionEndpointAllowlist(),
  },
  async findEndpoint(id) {
    const [endpoint] = await db
      .select({
        id: endpoints.id,
        name: endpoints.name,
        url: endpoints.url,
        priceUsdc: endpoints.priceUsdc,
        isActive: endpoints.isActive,
      })
      .from(endpoints)
      .where(eq(endpoints.id, id))
      .limit(1)

    return endpoint
  },
})
