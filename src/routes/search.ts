import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { env } from '../env.js'
import { db } from '../db/client.js'
import { embed } from '../lib/embeddings.js'
import { rowsOf } from '../lib/query.js'
import { redis } from '../lib/redis.js'

const schema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().positive().max(50).default(10),
  category: z.string().min(1).max(80).optional(),
  min_rating: z.coerce.number().min(0).max(5).default(0),
  dry: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('true'),
})

type SearchRow = {
  id: string
  url: string
  name: string
  description: string
  category: string
  price_usdc: number | string
  avg_rating: number | string
  rating_count: number | string
  avg_latency_ms: number | string
  similarity: number | string
}

function cacheKey(params: z.infer<typeof schema>) {
  return `search:${createHash('sha256').update(JSON.stringify(params)).digest('hex')}`
}

function requireSearchPayment(paymentHeader: string | undefined, dryRun: boolean) {
  if (env.NODE_ENV === 'development') return null
  if (dryRun) return null
  if (paymentHeader) return null
  return {
    success: false,
    error: 'payment_required',
    priceUsdc: 0.01,
    currency: 'USDC',
  }
}

export const searchRoute = new Hono().get('/', async (c) => {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'invalid_params', detail: parsed.error.flatten() }, 400)
  }

  const paymentError = requireSearchPayment(c.req.header('x-payment'), parsed.data.dry)
  if (paymentError) return c.json(paymentError, 402)

  const key = cacheKey(parsed.data)
  const cached = await redis.get(key)
  if (cached) return c.json(JSON.parse(cached))

  const embedding = await embed(parsed.data.q)
  const category = parsed.data.category ?? null
  const result = await db.execute(sql`
    SELECT id, url, name, description, category, price_usdc, avg_rating,
           rating_count, avg_latency_ms,
           1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM endpoints
    WHERE is_active = true
      AND embedding IS NOT NULL
      AND avg_rating >= ${parsed.data.min_rating}
      AND (${category}::text IS NULL OR category = ${category})
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${parsed.data.limit}
  `)

  const results = rowsOf<SearchRow>(result)
    .map((row) => {
      const similarity = Number(row.similarity)
      const avgRating = Number(row.avg_rating)
      return {
        id: row.id,
        url: row.url,
        name: row.name,
        description: row.description,
        category: row.category,
        priceUsdc: Number(row.price_usdc),
        avgRating,
        ratingCount: Number(row.rating_count),
        avgLatencyMs: Number(row.avg_latency_ms),
        score: Number((0.6 * similarity + 0.4 * (avgRating / 5)).toFixed(4)),
      }
    })
    .sort((a, b) => b.score - a.score)

  const payload = {
    results,
    total: results.length,
    query: parsed.data.q,
    dry: parsed.data.dry,
  }

  await redis.set(key, JSON.stringify(payload), 'EX', env.SEARCH_CACHE_TTL)
  return c.json(payload)
})
