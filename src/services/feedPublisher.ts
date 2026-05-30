import { redis } from '../lib/redis.js'
import type { FeedEvent } from './types.js'

export const feedPublisher = {
  async publish(event: FeedEvent) {
    const payload = JSON.stringify(event)
    await redis.publish('xoggai:feed', payload)
    await redis.lpush('xoggai:feed:history', payload)
    await redis.ltrim('xoggai:feed:history', 0, 99)
  },

  async publishRatingUpdate(opts: { eventId: string; score: number }) {
    await redis.publish(
      'xoggai:feed',
      JSON.stringify({
        type: 'rating_update',
        eventId: opts.eventId,
        score: opts.score,
      }),
    )
  },
}
