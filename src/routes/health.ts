import { Hono } from 'hono'
import { env } from '../env.js'

export const healthRoute = new Hono().get('/', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json({
    status: 'ok',
    service: 'xoggai-backend',
    version: env.SERVICE_VERSION,
    environment: env.DEPLOYMENT_ENVIRONMENT,
    uptimeSeconds: Math.floor(process.uptime()),
    ts: Date.now(),
  })
})
