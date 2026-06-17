import assert from 'node:assert/strict'
import { runPrepareCheck } from './test-x402-prepare.mjs'

const betaKey = 'operator-cli-test-key-at-least-32-characters'
const env = {
  XOGGAI_API_BASE: 'http://127.0.0.1:3000',
  BETA_EXECUTION_KEY: betaKey,
  TEST_X402_BUDGET: '0.005',
}

function response(paymentSigned = false) {
  return new Response(
    JSON.stringify({
      mode: 'prepare-only',
      requestId: 'operator-cli-test',
      paymentPrepared: true,
      paymentSigned,
      paymentSent: false,
      preview: {
        network: 'eip155:84532',
        amountUsdc: 0.002,
        asset: 'test-asset',
        recipient: 'test-recipient',
        resourceUrl: 'https://example.test/resource',
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

const output = await runPrepareCheck({
  env,
  log: () => {},
  async fetchImpl(url, options) {
    assert.equal(url.toString(), 'http://127.0.0.1:3000/execute/prepare')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['x-beta-key'], betaKey)
    assert.deepEqual(JSON.parse(options.body), { budget: 0.005 })
    return response()
  },
})

assert.equal(output.paymentPrepared, true)
assert.equal(output.paymentSigned, false)
assert.equal(output.paymentSent, false)
assert.equal(output.amountUsdc, 0.002)

await assert.rejects(
  runPrepareCheck({
    env,
    log: () => {},
    fetchImpl: async () => response(true),
  }),
  /paymentSigned and paymentSent must both be false/,
)

await assert.rejects(
  runPrepareCheck({
    env: { ...env, TEST_X402_BUDGET: '0.006' },
    log: () => {},
    fetchImpl: async () => response(),
  }),
  /between 0 and 0.005 USDC/,
)

console.log('x402 prepare operator CLI tests passed')
