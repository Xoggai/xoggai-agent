import { pool } from '../db/client.js'
import { env } from '../env.js'
import { redis } from '../lib/redis.js'

export type DependencyCheck = {
  status: 'ok' | 'error'
  latencyMs: number
  error?: string
}

async function timedCheck(
  name: string,
  operation: () => Promise<unknown>,
): Promise<DependencyCheck> {
  const startedAt = Date.now()
  let timeout: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${name}_timeout`)),
          env.READINESS_TIMEOUT_MS,
        )
      }),
    ])
    return { status: 'ok', latencyMs: Date.now() - startedAt }
  } catch (error) {
    const timedOut =
      error instanceof Error && error.message === `${name}_timeout`
    return {
      status: 'error',
      latencyMs: Date.now() - startedAt,
      error: timedOut ? `${name}_timeout` : `${name}_unavailable`,
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function runtimeReadiness(
  dependencies: {
    checkDatabase?: () => Promise<unknown>
    checkCache?: () => Promise<unknown>
  } = {},
) {
  const [database, cache] = await Promise.all([
    timedCheck(
      'database',
      dependencies.checkDatabase ?? (() => pool.query('select 1')),
    ),
    timedCheck('redis', dependencies.checkCache ?? (() => redis.ping())),
  ])
  const ready = database.status === 'ok' && cache.status === 'ok'

  return {
    ready,
    status: ready ? 'ready' : 'degraded',
    service: 'xoggai-backend',
    version: env.SERVICE_VERSION,
    environment: env.DEPLOYMENT_ENVIRONMENT,
    killSwitchActive: env.OPERATIONS_KILL_SWITCH,
    publicBetaEnabled: env.PUBLIC_BETA_ENABLED,
    dependencies: { database, cache },
    ts: Date.now(),
  }
}
