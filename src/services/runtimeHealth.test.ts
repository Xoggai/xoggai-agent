import assert from 'node:assert/strict'
import { operationalAvailability } from '../middleware/operationalGate.js'
import { redis } from '../lib/redis.js'
import { runtimeReadiness } from './runtimeHealth.js'

{
  const result = await runtimeReadiness({
    checkDatabase: async () => true,
    checkCache: async () => 'PONG',
  })
  assert.equal(result.ready, true)
  assert.equal(result.status, 'ready')
  assert.equal(result.dependencies.database.status, 'ok')
  assert.equal(result.dependencies.cache.status, 'ok')
}

{
  const result = await runtimeReadiness({
    checkDatabase: async () => {
      throw new Error('database_unavailable')
    },
    checkCache: async () => 'PONG',
  })
  assert.equal(result.ready, false)
  assert.equal(result.status, 'degraded')
  assert.equal(result.dependencies.database.status, 'error')
  assert.equal(result.dependencies.cache.status, 'ok')
}

assert.deepEqual(
  operationalAvailability({ killSwitchActive: true }),
  { available: false, reason: 'operations_kill_switch_active' },
)
assert.deepEqual(
  operationalAvailability({
    killSwitchActive: false,
    publicBetaEnabled: false,
  }),
  { available: false, reason: 'public_beta_temporarily_disabled' },
)
assert.deepEqual(
  operationalAvailability({
    killSwitchActive: false,
    publicBetaEnabled: true,
  }),
  { available: true },
)

console.log('runtime health and operational gate tests passed')
redis.disconnect()
