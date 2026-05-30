import { Worker } from 'bullmq'
import { eq, sql } from 'drizzle-orm'
import { env, hasLiveAnthropicKey } from '../env.js'
import {
  ANTHROPIC_RATING_MODEL,
  anthropic,
  extractAnthropicText,
} from '../lib/anthropic.js'
import { db } from '../db/client.js'
import { routingEvents } from '../db/schema.js'
import { createRedisConnectionOptions } from '../lib/redis.js'
import { feedPublisher } from './feedPublisher.js'

type RatingJob = {
  eventId: string
  intent: string
  response: unknown
}

function fallbackRating(response: unknown) {
  if (response && typeof response === 'object') {
    return { score: 4, reason: 'Development fallback rating for a structured response.' }
  }
  return { score: 2, reason: 'Development fallback rating for an empty or unstructured response.' }
}

async function rateWithClaude(intent: string, response: unknown) {
  if (!hasLiveAnthropicKey()) return fallbackRating(response)

  const prompt = `
You are an API quality rater. Rate the following API response on a scale of 0.0 to 5.0.

Intent: "${intent}"
Response: ${JSON.stringify(response).slice(0, 2000)}

Scoring criteria:
- 5.0: Complete, accurate, all expected fields present, matches intent perfectly
- 4.0: Mostly complete, minor gaps, still useful
- 3.0: Partially relevant, some expected data missing
- 2.0: Mostly irrelevant or incomplete
- 1.0: Wrong data, empty fields, or mismatched intent
- 0.0: Error, timeout, or completely useless

Return ONLY a JSON object: {"score": <number>, "reason": "<one sentence>"}
`

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_RATING_MODEL,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = JSON.parse(extractAnthropicText(message.content)) as {
      score: number
      reason: string
    }

    return {
      score: Math.max(0, Math.min(5, Number(parsed.score))),
      reason: String(parsed.reason).slice(0, 500),
    }
  } catch (error) {
    if (env.NODE_ENV !== 'production') return fallbackRating(response)
    throw error
  }
}

export const ratingWorker = new Worker<RatingJob>(
  'rating',
  async (job) => {
    const { eventId, intent, response } = job.data
    const { score, reason } = await rateWithClaude(intent, response)

    await db
      .update(routingEvents)
      .set({ rating: score, ratingReason: reason })
      .where(eq(routingEvents.id, eventId))

    await db.execute(sql`
      UPDATE endpoints
      SET avg_rating = (avg_rating * rating_count + ${score}) / (rating_count + 1),
          rating_count = rating_count + 1,
          updated_at = now()
      WHERE id = (SELECT endpoint_id FROM routing_events WHERE id = ${eventId})
    `)

    await feedPublisher.publishRatingUpdate({ eventId, score })
  },
  { connection: createRedisConnectionOptions() },
)
