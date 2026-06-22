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

{
  let logged = ''
  const output = await runOperatorCli({
    argv: ['sign', ticketId],
    env,
    log: (value) => {
      logged = value
    },
    async fetchImpl(url, options) {
      assert.equal(url.toString(), 'http://127.0.0.1:3000/execute/sign')
      assert.deepEqual(JSON.parse(options.body), {
        ticketId,
        signedBy: 'test-operator',
      })
      return jsonResponse({
        mode: 'sign-only',
        paymentSigned: true,
        paymentSent: false,
        ticket: { id: ticketId, status: 'SIGNED' },
        credential: {
          signerAddress: '0x0000000000000000000000000000000000000001',
          signatureHash: 'a'.repeat(64),
          paymentPayload: {
            x402Version: 2,
            resource: { url: 'https://example.test/paid' },
            accepted: { network: 'eip155:84532' },
            payload: {
              authorization: { value: '2000' },
              signature: '0xsecret',
            },
          },
        },
      })
    },
  })

  assert.equal(output.paymentSigned, true)
  assert.equal(output.paymentSent, false)
  assert.equal(logged.includes('0xsecret'), false)
  assert.equal(logged.includes('[REDACTED]'), true)
}

{
  const calls = []
  const output = await runOperatorCli({
    argv: ['sign-verify', ticketId],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      calls.push(url.toString())
      if (url.toString().endsWith('/execute/sign')) {
        return jsonResponse({
          mode: 'sign-only',
          paymentSigned: true,
          paymentSent: false,
          ticket: { id: ticketId, status: 'SIGNED' },
          credential: {
            paymentPayload: {
              x402Version: 2,
              resource: { url: 'https://example.test/paid' },
              accepted: {
                scheme: 'exact',
                network: 'eip155:84532',
              },
              payload: { signature: '0xsecret' },
            },
          },
        })
      }
      assert.deepEqual(JSON.parse(options.body), {
        ticketId,
        verifiedBy: 'test-operator',
        paymentPayload: {
          x402Version: 2,
          resource: { url: 'https://example.test/paid' },
          accepted: {
            scheme: 'exact',
            network: 'eip155:84532',
          },
          payload: { signature: '0xsecret' },
        },
      })
      return jsonResponse({
        success: true,
        mode: 'verify-only',
        verificationCompleted: true,
        paymentVerified: false,
        paymentSettled: false,
        paymentSent: false,
        ticket: {
          id: ticketId,
          status: 'SIGNED',
          verificationStatus: 'INVALID',
        },
        verification: {
          isValid: false,
          invalidReason: 'insufficient_funds',
        },
      })
    },
  })

  assert.deepEqual(calls, [
    'http://127.0.0.1:3000/execute/sign',
    'http://127.0.0.1:3000/execute/verify',
  ])
  assert.equal(output.paymentSigned, true)
  assert.equal(output.paymentVerified, false)
  assert.equal(output.paymentSettled, false)
  assert.equal(output.paymentSent, false)
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
    argv: ['sign', ticketId],
    env,
    log: () => {},
    fetchImpl: async () =>
      jsonResponse({
        mode: 'sign-only',
        paymentSigned: true,
        paymentSent: true,
      }),
  }),
  /paymentSent must be false/,
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
