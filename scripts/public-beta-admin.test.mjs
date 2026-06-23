import assert from 'node:assert/strict'
import { runPublicBetaAdmin } from './public-beta-admin.mjs'

const env = {
  XOGGAI_API_BASE: 'https://example.test',
  PUBLIC_BETA_ADMIN_KEY: 'admin-key-that-is-at-least-32-characters',
  X402_OPERATOR: 'test-admin',
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

{
  const output = await runPublicBetaAdmin({
    argv: ['create-user', 'user@example.com', 'Agent User'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url, 'https://example.test/api/admin/beta/users')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['x-admin-key'], env.PUBLIC_BETA_ADMIN_KEY)
      const body = JSON.parse(options.body)
      assert.equal(body.email, 'user@example.com')
      assert.equal(body.maxBudgetUsdc, 0.005)
      return response({ success: true, apiKey: 'xg_beta_secret' }, 201)
    },
  })
  assert.equal(output.success, true)
}

{
  await runPublicBetaAdmin({
    argv: ['ops'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url, 'https://example.test/api/admin/ops')
      assert.equal(options.method, 'GET')
      return response({ success: true, operations: {} })
    },
  })
}

{
  await runPublicBetaAdmin({
    argv: ['set-user-status', 'user-id', 'SUSPENDED'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url, 'https://example.test/api/admin/beta/users/user-id')
      assert.equal(options.method, 'PATCH')
      assert.deepEqual(JSON.parse(options.body), {
        status: 'SUSPENDED',
        actorId: 'test-admin',
      })
      return response({ success: true })
    },
  })
}

{
  await runPublicBetaAdmin({
    argv: ['keys', 'user-id'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(
        url,
        'https://example.test/api/admin/beta/users/user-id/keys',
      )
      assert.equal(options.method, 'GET')
      return response({ success: true, keys: [] })
    },
  })
}

{
  await runPublicBetaAdmin({
    argv: ['decide', 'request-id', 'APPROVED', 'Reviewed'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(
        url,
        'https://example.test/api/admin/beta/requests/request-id',
      )
      assert.equal(options.method, 'PATCH')
      assert.deepEqual(JSON.parse(options.body), {
        status: 'APPROVED',
        reason: 'Reviewed',
        approvedBy: 'test-admin',
      })
      return response({ success: true })
    },
  })
}

console.log('public beta admin CLI tests passed')
