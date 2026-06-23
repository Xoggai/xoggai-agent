import { createHash } from 'node:crypto'

export type RateLimitStore = {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

export function hashAbuseIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeIdempotencyKey(value: string | undefined) {
  const key = value?.trim()
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return undefined
  return key
}

export function publicBetaRequestFingerprint(input: {
  intent: string
  budgetUsdc: number
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        intent: input.intent.trim(),
        budgetUsdc: input.budgetUsdc,
      }),
    )
    .digest('hex')
}

export async function consumeIdentityRateLimit(input: {
  scope: string
  identity: string
  limit: number
  windowMs: number
  now?: number
  store?: RateLimitStore
}) {
  const now = input.now ?? Date.now()
  const bucket = Math.floor(now / input.windowMs)
  const resetAt = (bucket + 1) * input.windowMs
  const identityHash = hashAbuseIdentifier(input.identity)
  const key = `abuse:${input.scope}:${identityHash}:${bucket}`
  const store =
    input.store ?? (await import('../lib/redis.js')).redis
  const count = await store.incr(key)
  if (count === 1) {
    await store.expire(key, Math.max(1, Math.ceil(input.windowMs / 1000)))
  }
  return {
    allowed: count <= input.limit,
    count,
    limit: input.limit,
    remaining: Math.max(input.limit - count, 0),
    resetAt,
    identityHash,
  }
}
