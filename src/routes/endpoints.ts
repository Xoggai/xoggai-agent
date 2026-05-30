import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { endpoints } from '../db/schema.js'

const schema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  category: z.string().min(1).max(80).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('true'),
})

export const endpointsRoute = new Hono().get('/', async (c) => {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'invalid_params', detail: parsed.error.flatten() }, 400)
  }

  const filters = [
    eq(endpoints.isActive, parsed.data.active),
    parsed.data.category ? eq(endpoints.category, parsed.data.category) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({
      id: endpoints.id,
      url: endpoints.url,
      name: endpoints.name,
      description: endpoints.description,
      category: endpoints.category,
      priceUsdc: endpoints.priceUsdc,
      avgRating: endpoints.avgRating,
      ratingCount: endpoints.ratingCount,
      avgLatencyMs: endpoints.avgLatencyMs,
      isActive: endpoints.isActive,
    })
    .from(endpoints)
    .where(and(...filters))
    .orderBy(desc(endpoints.avgRating), desc(endpoints.ratingCount))
    .limit(parsed.data.limit)

  return c.json({ results: rows, total: rows.length })
})
