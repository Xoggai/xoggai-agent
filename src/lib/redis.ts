import { Redis } from 'ioredis'
import { env } from '../env.js'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  })
}

export function createRedisConnectionOptions() {
  const url = new URL(env.REDIS_URL)
  const db = url.pathname.replace('/', '')

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: db ? Number(db) : undefined,
    maxRetriesPerRequest: null,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  }
}

export const rateLimitRedisClient = {
  async scriptLoad(script: string) {
    return String(await redis.script('LOAD', script))
  },

  async evalsha<TArgs extends unknown[], TData = unknown>(
    sha1: string,
    keys: string[],
    args: TArgs,
  ) {
    return redis.evalsha(
      sha1,
      keys.length,
      ...keys,
      ...(args as Array<string | number | Buffer>),
    ) as Promise<TData>
  },

  async decr(key: string) {
    return redis.decr(key)
  },

  async del(key: string) {
    return redis.del(key)
  },
}
