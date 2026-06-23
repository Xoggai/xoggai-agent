import { Hono } from 'hono'
import { runtimeReadiness } from '../services/runtimeHealth.js'

export const readinessRoute = new Hono().get('/', async (c) => {
  c.header('Cache-Control', 'no-store')
  const readiness = await runtimeReadiness()
  return c.json(readiness, readiness.ready ? 200 : 503)
})
