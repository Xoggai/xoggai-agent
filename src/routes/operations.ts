import { Hono } from 'hono'
import { pool } from '../db/client.js'
import { env } from '../env.js'
import { secureSecretEqual } from '../services/publicBetaAuth.js'
import { runtimeReadiness } from '../services/runtimeHealth.js'

function adminAuthorized(candidate: string | undefined) {
  return Boolean(
    candidate &&
      env.PUBLIC_BETA_ADMIN_KEY &&
      secureSecretEqual(candidate, env.PUBLIC_BETA_ADMIN_KEY),
  )
}

export const operationsRoute = new Hono()
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    if (!env.PUBLIC_BETA_ADMIN_KEY) {
      return c.json({ success: false, error: 'operations_not_configured' }, 503)
    }
    if (!adminAuthorized(c.req.header('x-admin-key'))) {
      return c.json({ success: false, error: 'invalid_admin_access' }, 401)
    }
    await next()
  })
  .get('/', async (c) => {
    const readiness = await runtimeReadiness()
    const result = await pool.query<{
      active_users: number
      active_sessions: number
      pending_requests: number
      requests_last_24h: number
    }>(`
      select
        (select count(*)::int from beta_users where status = 'ACTIVE') active_users,
        (select count(*)::int from beta_sessions
          where revoked_at is null and expires_at > now()) active_sessions,
        (select count(*)::int from beta_execution_requests
          where status = 'REQUESTED') pending_requests,
        (select count(*)::int from beta_execution_requests
          where created_at >= now() - interval '24 hours') requests_last_24h
    `)
    const counts = result.rows[0] ?? {
      active_users: 0,
      active_sessions: 0,
      pending_requests: 0,
      requests_last_24h: 0,
    }

    return c.json({
      success: true,
      readiness,
      operations: {
        killSwitchActive: env.OPERATIONS_KILL_SWITCH,
        publicBetaEnabled: env.PUBLIC_BETA_ENABLED,
        paymentSendingEnabled:
          env.X402_SETTLEMENT_ENABLED ||
          env.X402_UPSTREAM_EXECUTION_ENABLED,
      },
      beta: {
        activeUsers: counts.active_users,
        activeSessions: counts.active_sessions,
        pendingRequests: counts.pending_requests,
        requestsLast24Hours: counts.requests_last_24h,
      },
    })
  })
