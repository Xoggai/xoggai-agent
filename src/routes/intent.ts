import { Hono } from 'hono'
import { z } from 'zod'
import { intentRouter } from '../services/intentRouter.js'

const schema = z.object({
  q: z.string().min(3).max(500),
  budget: z.coerce.number().positive().max(10).default(0.05),
  dry: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
})

export const intentRoute = new Hono().get('/', async (c) => {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'invalid_params', detail: parsed.error.flatten() }, 400)
  }

  const result = await intentRouter(parsed.data)
  return c.json(result, result.success ? 200 : result.error === 'budget_exceeded' ? 402 : 404)
})
