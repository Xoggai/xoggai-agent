import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { env } from '../env.js'
import { db } from '../db/client.js'
import { stats } from '../db/schema.js'
import { redis } from '../lib/redis.js'

export const statsRoute = new Hono().get('/', async (c) => {
  const cached = await redis.get('stats:global')
  if (cached) return c.json(JSON.parse(cached))

  const [row] = await db.select().from(stats).where(eq(stats.id, 1)).limit(1)
  const payload = row
    ? {
        activeAgents: row.activeAgents,
        totalTx: row.totalTx,
        apisConsumed: row.apisConsumed,
        hoursSaved: row.hoursSaved,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      }
    : {
        activeAgents: 0,
        totalTx: 0,
        apisConsumed: 0,
        hoursSaved: 0,
        updatedAt: new Date().toISOString(),
      }

  await redis.set('stats:global', JSON.stringify(payload), 'EX', env.STATS_CACHE_TTL)
  return c.json(payload)
})
