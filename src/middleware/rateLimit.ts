import { createMiddleware } from 'hono/factory'
import { env } from '../env.js'
import { redis } from '../lib/redis.js'

function getClientKey(forwardedFor: string | undefined) {
  return forwardedFor?.split(',')[0]?.trim() || 'unknown'
}

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const windowSeconds = Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000)
  const bucket = Math.floor(Date.now() / env.RATE_LIMIT_WINDOW_MS)
  const clientKey = getClientKey(c.req.header('x-forwarded-for'))
  const redisKey = `rate-limit:${clientKey}:${bucket}`

  try {
    const count = await redis.incr(redisKey)

    if (count === 1) {
      await redis.expire(redisKey, windowSeconds)
    }

    c.header('X-RateLimit-Limit', String(env.RATE_LIMIT_MAX))
    c.header('X-RateLimit-Remaining', String(Math.max(env.RATE_LIMIT_MAX - count, 0)))
    c.header('X-RateLimit-Reset', String((bucket + 1) * windowSeconds))

    if (count > env.RATE_LIMIT_MAX) {
      return c.json({ success: false, error: 'rate_limit_exceeded' }, 429)
    }
  } catch (error) {
    console.error('rate limiter unavailable', error)
  }

  await next()
})
