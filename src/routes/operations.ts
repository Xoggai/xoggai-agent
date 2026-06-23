import { Hono } from 'hono'
import { pool } from '../db/client.js'
import { env } from '../env.js'
import { secureSecretEqual } from '../services/publicBetaAuth.js'
import { runtimeReadiness } from '../services/runtimeHealth.js'
import { evaluateReliabilityAlerts } from '../services/reliabilityAlerts.js'
import { expireStalePublicBetaRequests } from '../services/publicBetaRequests.js'

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
    await expireStalePublicBetaRequests()
    const readiness = await runtimeReadiness()
    const result = await pool.query<{
      active_users: number
      active_sessions: number
      pending_requests: number
      requests_last_24h: number
      requests_last_5m: number
      failures_last_15m: number
      expired_last_24h: number
      idempotent_replays_last_24h: number
      allowlisted_endpoints: number
    }>(`
      select
        (select count(*)::int from beta_users where status = 'ACTIVE') active_users,
        (select count(*)::int from beta_sessions
          where revoked_at is null and expires_at > now()) active_sessions,
        (select count(*)::int from beta_execution_requests
          where status = 'REQUESTED') pending_requests,
        (select count(*)::int from beta_execution_requests
          where created_at >= now() - interval '24 hours') requests_last_24h,
        (select count(*)::int from beta_execution_requests
          where created_at >= now() - interval '5 minutes') requests_last_5m,
        (select count(*)::int from beta_execution_requests
          where status = 'EXECUTION_FAILED'
            and updated_at >= now() - interval '15 minutes') failures_last_15m,
        (select count(*)::int from beta_execution_requests
          where status = 'EXPIRED'
            and updated_at >= now() - interval '24 hours') expired_last_24h,
        (select count(*)::int from beta_audit_events
          where action = 'EXECUTION_REQUEST_REPLAYED'
            and created_at >= now() - interval '24 hours') idempotent_replays_last_24h,
        (select count(*)::int from execution_endpoint_allowlist
          where enabled = true) allowlisted_endpoints
    `)
    const counts = result.rows[0] ?? {
      active_users: 0,
      active_sessions: 0,
      pending_requests: 0,
      requests_last_24h: 0,
      requests_last_5m: 0,
      failures_last_15m: 0,
      expired_last_24h: 0,
      idempotent_replays_last_24h: 0,
      allowlisted_endpoints: 0,
    }
    const reliability = {
      requestsLast5Minutes: counts.requests_last_5m,
      failuresLast15Minutes: counts.failures_last_15m,
      expiredLast24Hours: counts.expired_last_24h,
      idempotentReplaysLast24Hours: counts.idempotent_replays_last_24h,
    }
    const alerts = evaluateReliabilityAlerts(reliability, {
      requestSpike: env.PUBLIC_BETA_ALERT_REQUEST_SPIKE,
      executionFailures: env.PUBLIC_BETA_ALERT_FAILURE_THRESHOLD,
    })
    if (alerts.length > 0) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'reliability_alerts_active',
          alerts,
          ts: new Date().toISOString(),
        }),
      )
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
      reliability: {
        ...reliability,
        allowlistedEndpoints: counts.allowlisted_endpoints,
        status: alerts.length === 0 ? 'healthy' : 'attention',
        alerts,
      },
    })
  })
