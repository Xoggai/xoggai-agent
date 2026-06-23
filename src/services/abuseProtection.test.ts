import assert from 'node:assert/strict'
import {
  consumeIdentityRateLimit,
  hashAbuseIdentifier,
  normalizeIdempotencyKey,
  publicBetaRequestFingerprint,
} from './abuseProtection.js'

assert.equal(normalizeIdempotencyKey('request_1234'), 'request_1234')
assert.equal(normalizeIdempotencyKey('short'), undefined)
assert.equal(normalizeIdempotencyKey('invalid key!'), undefined)
assert.equal(hashAbuseIdentifier('secret').length, 64)
assert.equal(
  publicBetaRequestFingerprint({ intent: 'price ETH', budgetUsdc: 0.002 }),
  publicBetaRequestFingerprint({ intent: 'price ETH', budgetUsdc: 0.002 }),
)
assert.notEqual(
  publicBetaRequestFingerprint({ intent: 'price ETH', budgetUsdc: 0.002 }),
  publicBetaRequestFingerprint({ intent: 'price BTC', budgetUsdc: 0.002 }),
)

const values = new Map<string, number>()
const store = {
  async incr(key: string) {
    const value = (values.get(key) ?? 0) + 1
    values.set(key, value)
    return value
  },
  async expire() {},
}
const first = await consumeIdentityRateLimit({
  scope: 'test', identity: 'user-1', limit: 2, windowMs: 60_000, now: 1, store,
})
const second = await consumeIdentityRateLimit({
  scope: 'test', identity: 'user-1', limit: 2, windowMs: 60_000, now: 1, store,
})
const third = await consumeIdentityRateLimit({
  scope: 'test', identity: 'user-1', limit: 2, windowMs: 60_000, now: 1, store,
})
assert.equal(first.allowed, true)
assert.equal(second.remaining, 0)
assert.equal(third.allowed, false)

console.log('abuse protection tests passed')
