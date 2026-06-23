import assert from 'node:assert/strict'
import {
  authenticateBetaAccess,
  parseBetaAccessProfiles,
} from './betaAccess.js'

const defaults = {
  maxBudgetUsdc: 0.005,
  dailyRequestLimit: 25,
  dailyBudgetUsdc: 0.05,
}

{
  const profiles = parseBetaAccessProfiles({
    betaAccessKeys: JSON.stringify([
      {
        id: 'agent-alpha',
        label: 'Agent Alpha',
        key: 'a'.repeat(40),
        maxBudgetUsdc: 0.5,
        dailyRequestLimit: 5,
        dailyBudgetUsdc: 0.01,
      },
      {
        id: 'agent-disabled',
        key: 'b'.repeat(40),
        enabled: false,
      },
    ]),
    ...defaults,
  })

  assert.equal(profiles.length, 2)
  assert.equal(profiles[0]?.id, 'agent-alpha')
  assert.equal(profiles[0]?.maxBudgetUsdc, 0.005)
  assert.equal(profiles[1]?.enabled, false)
}

{
  const access = authenticateBetaAccess({
    candidate: 'a'.repeat(40),
    betaAccessKeys: JSON.stringify([
      {
        id: 'agent-alpha',
        label: 'Agent Alpha',
        key: 'a'.repeat(40),
      },
    ]),
    ...defaults,
  })

  assert.deepEqual(access, {
    id: 'agent-alpha',
    label: 'Agent Alpha',
    enabled: true,
    ...defaults,
  })
}

{
  const access = authenticateBetaAccess({
    candidate: 'legacy-key-that-is-at-least-32-characters',
    betaExecutionKey: 'legacy-key-that-is-at-least-32-characters',
    ...defaults,
  })

  assert.equal(access?.id, 'legacy-operator')
}

{
  const access = authenticateBetaAccess({
    candidate: 'b'.repeat(40),
    betaAccessKeys: JSON.stringify([
      {
        id: 'agent-disabled',
        key: 'b'.repeat(40),
        enabled: false,
      },
    ]),
    ...defaults,
  })

  assert.equal(access, undefined)
}

assert.throws(
  () =>
    parseBetaAccessProfiles({
      betaAccessKeys: '{}',
      ...defaults,
    }),
  /BETA_ACCESS_KEYS must be a JSON array/,
)

console.log('beta access tests passed')
