import assert from 'node:assert/strict'
import {
  bearerToken,
  generatePublicBetaApiKey,
  generatePublicBetaSessionToken,
  hashPublicBetaSecret,
  secureSecretEqual,
} from './publicBetaAuth.js'

{
  const first = generatePublicBetaApiKey()
  const second = generatePublicBetaApiKey()
  assert.match(first, /^xg_beta_[A-Za-z0-9_-]{40,}$/)
  assert.notEqual(first, second)
  assert.equal(hashPublicBetaSecret(first).length, 64)
}

{
  const token = generatePublicBetaSessionToken()
  assert.match(token, /^xg_session_[A-Za-z0-9_-]{40,}$/)
}

assert.equal(secureSecretEqual('same-secret', 'same-secret'), true)
assert.equal(secureSecretEqual('wrong', 'same-secret'), false)
assert.equal(bearerToken('Bearer session-token'), 'session-token')
assert.equal(bearerToken('Basic nope'), undefined)
assert.equal(bearerToken(undefined), undefined)

console.log('public beta auth tests passed')
