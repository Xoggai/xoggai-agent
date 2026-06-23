import { randomUUID } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { env } from '../env.js'

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const suppliedRequestId = c.req.header('x-request-id')?.slice(0, 128)
  const requestId =
    suppliedRequestId && /^[A-Za-z0-9._-]+$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID()
  const startedAt = Date.now()
  c.header('X-Request-Id', requestId)

  try {
    await next()
  } finally {
    const entry = {
      level: c.res.status >= 500 ? 'error' : 'info',
      event: 'http_request',
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
      environment: env.DEPLOYMENT_ENVIRONMENT,
      version: env.SERVICE_VERSION,
      ts: new Date().toISOString(),
    }
    console.log(JSON.stringify(entry))
  }
})
