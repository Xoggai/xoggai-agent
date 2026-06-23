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
  const phase5Env = {
    ...env,
    XOGGAI_API_BASE: 'https://xoggai-backend.onrender.com',
    X402_CONFIRM_UPSTREAM_EXECUTION: 'EXECUTE_X402_BASE_SEPOLIA',
  }
  const output = await runOperatorCli({
    argv: ['phase5-preflight'],
    env: phase5Env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(
        url.toString(),
        'https://xoggai-backend.onrender.com/api/execution-status',
      )
      assert.equal(options.method, 'GET')
      return jsonResponse({
        status: 'ok',
        safetyMode: 'testnet-upstream-execution',
        network: 'base-sepolia',
        prepareEnabled: true,
        ticketSigningEnabled: true,
        ticketVerificationEnabled: true,
        ticketSettlementEnabled: false,
        upstreamExecutionEnabled: true,
        liveExecutionEnabled: false,
        paymentSendingEnabled: true,
        walletConfigured: true,
        betaAccessConfigured: true,
        maxExecutionBudgetUsdc: 0.005,
      })
    },
  })

  assert.equal(output.ready, true)
  assert.equal(output.blockedBy.length, 0)
}

await assert.rejects(
  runOperatorCli({
    argv: ['phase5-preflight'],
    env,
    log: () => {},
    async fetchImpl() {
      return jsonResponse({
        status: 'ok',
        safetyMode: 'ticket-rehearsal',
        network: 'base-mainnet',
        prepareEnabled: true,
        ticketSigningEnabled: false,
        ticketVerificationEnabled: false,
        ticketSettlementEnabled: false,
        upstreamExecutionEnabled: false,
        liveExecutionEnabled: false,
        paymentSendingEnabled: false,
        walletConfigured: false,
        betaAccessConfigured: true,
        maxExecutionBudgetUsdc: 0.05,
      })
    },
  }),
  /Phase 5 preflight blocked/,
)

{
  const output = await runOperatorCli({
    argv: ['ledger', '10'],
    env,
    log: () => {},
    async fetchImpl(url, options) {
      assert.equal(
        url.toString(),
        'http://127.0.0.1:3000/api/beta/executions?limit=10',
      )
      assert.equal(options.method, 'GET')
      assert.equal(options.headers['x-beta-key'], betaKey)
      return jsonResponse({
        success: true,
        betaAccess: { id: 'agent-alpha', label: 'Agent Alpha' },
        usage: { requestCount: 1, remainingRequests: 4 },
        executions: [{ id: ticketId, status: 'EXECUTED' }],
      })
    },
  })
  assert.equal(output.executions[0].status, 'EXECUTED')
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

{
  const calls = []
  const settlementEnv = {
    ...env,
    X402_CONFIRM_SETTLEMENT: 'SETTLE_BASE_SEPOLIA',
  }
  const output = await runOperatorCli({
    argv: ['sign-verify-settle', ticketId],
    env: settlementEnv,
    log: () => {},
    async fetchImpl(url, options) {
      calls.push(url.toString())
      if (url.toString().endsWith('/execute/sign')) {
        return jsonResponse({
          mode: 'sign-only',
          paymentSigned: true,
          paymentSent: false,
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
      if (url.toString().endsWith('/execute/verify')) {
        return jsonResponse({
          mode: 'verify-only',
          verificationCompleted: true,
          paymentVerified: true,
          paymentSettled: false,
          paymentSent: false,
          ticket: { id: ticketId, status: 'VERIFIED' },
        })
      }
      assert.deepEqual(JSON.parse(options.body), {
        ticketId,
        settledBy: 'test-operator',
        settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
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
        mode: 'settlement',
        paymentSettled: true,
        paymentSent: true,
        ticket: { id: ticketId, status: 'SETTLED' },
        settlement: {
          success: true,
          transaction: `0x${'a'.repeat(64)}`,
          network: 'eip155:84532',
        },
      })
    },
  })

  assert.deepEqual(calls, [
    'http://127.0.0.1:3000/execute/sign',
    'http://127.0.0.1:3000/execute/verify',
    'http://127.0.0.1:3000/execute/settle',
  ])
  assert.equal(output.paymentSettled, true)
  assert.equal(output.paymentSent, true)
}

await assert.rejects(
  runOperatorCli({
    argv: ['sign-verify-settle', ticketId],
    env,
    log: () => {},
    fetchImpl: async () => jsonResponse({}),
  }),
  /X402_CONFIRM_SETTLEMENT must equal SETTLE_BASE_SEPOLIA/,
)

{
  const calls = []
  const executionEnv = {
    ...env,
    X402_CONFIRM_UPSTREAM_EXECUTION: 'EXECUTE_X402_BASE_SEPOLIA',
  }
  const output = await runOperatorCli({
    argv: ['sign-verify-execute', ticketId],
    env: executionEnv,
    log: () => {},
    async fetchImpl(url, options) {
      calls.push(url.toString())
      if (url.toString().endsWith('/execute/sign')) {
        return jsonResponse({
          mode: 'sign-only',
          paymentSigned: true,
          paymentSent: false,
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
      if (url.toString().endsWith('/execute/verify')) {
        return jsonResponse({
          mode: 'verify-only',
          verificationCompleted: true,
          paymentVerified: true,
          paymentSettled: false,
          paymentSent: false,
          ticket: { id: ticketId, status: 'VERIFIED' },
        })
      }
      assert.deepEqual(JSON.parse(options.body), {
        ticketId,
        executedBy: 'test-operator',
        executionConfirmation: 'EXECUTE_X402_BASE_SEPOLIA',
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
        mode: 'upstream-execution',
        paymentSent: true,
        ticket: { id: ticketId, status: 'EXECUTED' },
        upstream: {
          statusCode: 200,
          responseHash: 'b'.repeat(64),
        },
        settlement: {
          success: true,
          transaction: `0x${'c'.repeat(64)}`,
          network: 'eip155:84532',
        },
      })
    },
  })

  assert.deepEqual(calls, [
    'http://127.0.0.1:3000/execute/sign',
    'http://127.0.0.1:3000/execute/verify',
    'http://127.0.0.1:3000/execute/upstream',
  ])
  assert.equal(output.paymentVerified, true)
  assert.equal(output.paymentSent, true)
}

await assert.rejects(
  runOperatorCli({
    argv: ['sign-verify-execute', ticketId],
    env,
    log: () => {},
    fetchImpl: async () => jsonResponse({}),
  }),
  /X402_CONFIRM_UPSTREAM_EXECUTION must equal EXECUTE_X402_BASE_SEPOLIA/,
)

{
  const calls = []
  const executionEnv = {
    ...env,
    X402_CONFIRM_UPSTREAM_EXECUTION: 'EXECUTE_X402_BASE_SEPOLIA',
  }
  const output = await runOperatorCli({
    argv: ['phase6-run', '0.005'],
    env: executionEnv,
    log: () => {},
    async fetchImpl(url) {
      const path = new URL(url).pathname
      calls.push(path)
      if (path === '/api/execution-status') {
        return jsonResponse({
          safetyMode: 'testnet-upstream-execution',
          network: 'base-sepolia',
          prepareEnabled: true,
          ticketSigningEnabled: true,
          ticketVerificationEnabled: true,
          ticketSettlementEnabled: false,
          upstreamExecutionEnabled: true,
          liveExecutionEnabled: false,
          paymentSendingEnabled: true,
          walletConfigured: true,
          betaAccessConfigured: true,
          maxExecutionBudgetUsdc: 0.005,
        })
      }
      if (path === '/execute/prepare') {
        return jsonResponse({
          mode: 'prepare-only',
          requestId: 'phase6-prepare',
          betaAccess: { id: 'agent-alpha', label: 'Agent Alpha' },
          paymentPrepared: true,
          paymentSigned: false,
          paymentSent: false,
          ticket: { id: ticketId, status: 'PREPARED' },
          preview: { amountUsdc: 0.002 },
        })
      }
      if (path === '/execute/approve') {
        return jsonResponse({
          mode: 'approval-only',
          paymentApproved: true,
          paymentSigned: false,
          paymentSent: false,
          ticket: { id: ticketId, status: 'APPROVED' },
        })
      }
      if (path === '/execute/consume') {
        return jsonResponse({
          mode: 'consume-only',
          paymentConsumed: true,
          paymentSigned: false,
          paymentSent: false,
          ticket: { id: ticketId, status: 'CONSUMED' },
        })
      }
      if (path === '/execute/sign') {
        return jsonResponse({
          mode: 'sign-only',
          paymentSigned: true,
          paymentSent: false,
          credential: {
            paymentPayload: {
              x402Version: 2,
              resource: { url: 'https://example.test/paid' },
              accepted: { network: 'eip155:84532' },
              payload: { signature: '0xsecret' },
            },
          },
        })
      }
      if (path === '/execute/verify') {
        return jsonResponse({
          mode: 'verify-only',
          paymentVerified: true,
          paymentSettled: false,
          paymentSent: false,
          ticket: { id: ticketId, status: 'VERIFIED' },
        })
      }
      return jsonResponse({
        mode: 'upstream-execution',
        paymentSent: true,
        ticket: { id: ticketId, status: 'EXECUTED' },
        upstream: { statusCode: 200, responseHash: 'b'.repeat(64) },
        settlement: {
          transaction: `0x${'c'.repeat(64)}`,
          network: 'eip155:84532',
        },
      })
    },
  })

  assert.deepEqual(calls, [
    '/api/execution-status',
    '/execute/prepare',
    '/execute/approve',
    '/execute/consume',
    '/execute/sign',
    '/execute/verify',
    '/execute/upstream',
  ])
  assert.equal(output.mode, 'phase6-run')
  assert.equal(output.paymentSent, true)
  assert.equal(output.betaAccess.id, 'agent-alpha')
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
