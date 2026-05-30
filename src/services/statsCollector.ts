import cron from 'node-cron'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stats } from '../db/schema.js'
import { redis } from '../lib/redis.js'
import { rowsOf } from '../lib/query.js'

type StatsRow = {
  active_agents: number | string
  total_tx: number | string
  apis_consumed: number | string
  hours_saved: number | string
}

export async function collectStats() {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT DATE_TRUNC('hour', created_at)) AS active_agents,
      COUNT(*) AS total_tx,
      COUNT(DISTINCT endpoint_id) AS apis_consumed,
      ROUND(COUNT(*) * 0.25, 0) AS hours_saved
    FROM routing_events
    WHERE created_at > NOW() - INTERVAL '30 days'
      AND status = 'success'
  `)

  const row = rowsOf<StatsRow>(result)[0] ?? {
    active_agents: 0,
    total_tx: 0,
    apis_consumed: 0,
    hours_saved: 0,
  }

  const payload = {
    activeAgents: Number(row.active_agents),
    totalTx: Number(row.total_tx),
    apisConsumed: Number(row.apis_consumed),
    hoursSaved: Number(row.hours_saved),
    updatedAt: new Date(),
  }

  await db
    .insert(stats)
    .values({ id: 1, ...payload })
    .onConflictDoUpdate({
      target: stats.id,
      set: payload,
    })

  await redis.del('stats:global')
}

export function startStatsCollector() {
  cron.schedule('* * * * *', async () => {
    try {
      await collectStats()
    } catch (error) {
      console.error('statsCollector failed', error)
    }
  })

  void collectStats().catch((error) => {
    console.error('initial statsCollector run failed', error)
  })
}
