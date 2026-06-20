import assert from 'node:assert/strict'
import { runOperatorCli } from './x402-operator.mjs'

const betaKey = 'operator-wrapper-test-key-at-least-32-characters'
const ticketId = '11111111-1111-4111-8111-111111111111'
const env = {
  XOGGAI_API_BASE: 'http://127.0.0.1:3000',
  BETA_EXECUTION_KEY: betaKey,
  TEST_X402_BUDGET: '0.005',
  X402_OPERATOR: 'test-operator',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

{
  const output = await runOperatorCli({
    argv: ['status'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url.toString(), 'http://127.0.0.1:3000/api/execution-status')
      assert.equal(options.method, 'GET')
      return jsonResponse({
        status: 'ok',
        safetyMode: 'ticket-rehearsal',
        paymentSigningEnabled: false,
        paymentSendingEnabled: false,
      })
    },
  })

  assert.equal(output.safetyMode, 'ticket-rehearsal')
}

{
  const output = await runOperatorCli({
    argv: ['prepare'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url.toString(), 'http://127.0.0.1:3000/execute/prepare')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['x-beta-key'], betaKey)
      assert.deepEqual(JSON.parse(options.body), { budget: 0.005 })
      return jsonResponse({
        mode: 'prepare-only',
        requestId: 'prepare-request',
        paymentPrepared: true,
        paymentSigned: false,
        paymentSent: false,
        ticket: { id: ticketId, status: 'PREPARED' },
        preview: { amountUsdc: 0.002 },
      })
    },
  })

  assert.equal(output.paymentPrepared, true)
  assert.equal(output.ticket.id, ticketId)
}

{
  const output = await runOperatorCli({
    argv: ['approve', ticketId],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url.toString(), 'http://127.0.0.1:3000/execute/approve')
      assert.deepEqual(JSON.parse(options.body), {
        ticketId,
        approvedBy: 'test-operator',
      })
      return jsonResponse({
        mode: 'approval-only',
        paymentApproved: true,
        paymentSigned: false,
        paymentSent: false,
        ticket: { id: ticketId, status: 'APPROVED' },
      })
    },
  })

  assert.equal(output.paymentApproved, true)
}

{
  const output = await runOperatorCli({
    argv: ['consume', ticketId],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(url.toString(), 'http://127.0.0.1:3000/execute/consume')
      assert.deepEqual(JSON.parse(options.body), {
        ticketId,
        consumedBy: 'test-operator',
      })
      return jsonResponse({
        mode: 'consume-only',
        paymentConsumed: true,
        paymentSigned: false,
        paymentSent: false,
        ticket: { id: ticketId, status: 'CONSUMED' },
      })
    },
  })

  assert.equal(output.paymentConsumed, true)
}

await assert.rejects(
  runOperatorCli({
    argv: ['prepare'],
    env,
    log: () => {},
    fetchImpl: async () =>
      jsonResponse({
        mode: 'prepare-only',
        paymentPrepared: true,
        paymentSigned: true,
        paymentSent: false,
      }),
  }),
  /paymentSigned and paymentSent must both be false/,
)

await assert.rejects(
  runOperatorCli({
    argv: ['approve'],
    env,
    log: () => {},
    fetchImpl: async () => jsonResponse({}),
  }),
  /approve requires a ticket id/,
)

console.log('x402 operator wrapper CLI tests passed')
