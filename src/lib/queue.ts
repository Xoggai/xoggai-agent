import { Queue } from 'bullmq'
import { createRedisConnectionOptions } from './redis.js'

export const ratingQueue = new Queue('rating', {
  connection: createRedisConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2_000,
    },
    removeOnComplete: 500,
    removeOnFail: 500,
  },
})
