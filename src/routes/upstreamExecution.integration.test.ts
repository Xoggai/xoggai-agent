import assert from 'node:assert/strict'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import {
  PaymentTicketUpstreamExecutionError,
  type UpstreamExecutionPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import {
  X402UpstreamExecutionError,
  type UpstreamExecutionResult,
} from '../services/x402UpstreamExecution.js'
import { createUpstreamExecutionRoute } from './upstreamExecutionRoute.js'

const betaKey = 'beta-key-for-upstream-route-tests-32-characters'
const ticketId = '11111111-1111-4111-8111-111111111111'
const ticket: UpstreamExecutionPaymentTicket = {
  id: ticketId,
  status: 'VERIFIED',
  challengeHash:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  resourceUrl: 'https://example.test/paid',
  network: 'eip155:84532',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  assetName: 'USDC',
  assetVersion: '2',
  recipient: '0xd275612Bf0BB35638432c4D95eAA8D5d22346Ca6',
  amountAtomic: '2000',
  amountUsdc: 0.002,
  maxTimeoutSeconds: 60,
  signerAddress: '0x0000000000000000000000000000000000000001',
  signatureHash: 'a'.repeat(64),
  signedAt: '2026-06-20T12:00:30.000Z',
  expiresAt: '2026-06-20T12:01:00.000Z',
}
const paymentPayload = {
  x402Version: 2,
  resource: { url: ticket.resourceUrl },
  accepted: {
    scheme: 'exact',
    network: ticket.network,
    asset: ticket.asset,
    amount: ticket.amountAtomic,
    payTo: ticket.recipient,
    maxTimeoutSeconds: ticket.maxTimeoutSeconds,
    extra: { name: ticket.assetName, version: ticket.assetVersion },
  },
  payload: {
    signature: '0x1234',
    authorization: {
      from: ticket.signerAddress,
      to: ticket.recipient,
      value: ticket.amountAtomic,
    },
  },
  extensions: {},
} as PaymentPayload

function createApp(
  overrides: Partial<{
    enabled: boolean
    betaExecutionKey: string | undefined
    ticketError: PaymentTicketUpstreamExecutionError
    validationError: X402UpstreamExecutionError
    upstreamError: Error
    upstreamResponse: UpstreamExecutionResult
    calls: string[]
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/upstream',
    createUpstreamExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      async loadTicket() {
        overrides.calls?.push('load')
        if (overrides.ticketError) throw overrides.ticketError
        return ticket
      },
      validateExecution() {
        overrides.calls?.push('validate')
        if (overrides.validationError) throw overrides.validationError
      },
      async claimTicket() {
        overrides.calls?.push('claim')
      },
      async executeUpstream() {
        overrides.calls?.push('execute')
        if (overrides.upstreamError) throw overrides.upstreamError
        return (
          overrides.upstreamResponse ?? {
            success: true,
            statusCode: 200,
            responseHash: 'b'.repeat(64),
            responsePreview: '{"ok":true}',
            paymentResponseHash: 'c'.repeat(64),
            settlement: {
              success: true,
              transaction: `0x${'d'.repeat(64)}`,
              network: 'eip155:84532',
            },
          }
        )
      },
      async recordExecution(input) {
        overrides.calls?.push(
          input.unknown ? 'record-unknown' : 'record',
        )
        return {
          id: ticketId,
          status: input.success
            ? 'EXECUTED'
            : input.unknown
              ? 'UPSTREAM_UNKNOWN'
              : 'UPSTREAM_FAILED',
          upstreamStatus: input.success
            ? 'SUCCESS'
            : input.unknown
              ? 'UNKNOWN'
              : 'FAILED',
          ...(input.statusCode
            ? { upstreamStatusCode: input.statusCode }
            : {}),
          ...(input.responseHash
            ? { upstreamResponseHash: input.responseHash }
            : {}),
          ...(input.paymentResponseHash
            ? { upstreamPaymentResponseHash: input.paymentResponseHash }
            : {}),
          ...(input.settlementTransaction
            ? { settlementTransaction: input.settlementTransaction }
            : {}),
          ...(input.settlementNetwork
            ? { settlementNetwork: input.settlementNetwork }
            : {}),
          executedAt: '2026-06-20T12:00:50.000Z',
        }
      },
      createRequestId: () => 'upstream-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = {
    ticketId,
    executedBy: 'operator',
    executionConfirmation: 'EXECUTE_X402_BASE_SEPOLIA',
    paymentPayload,
  },
) {
  const response = await createApp(overrides).request('/execute/upstream', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-beta-key': key,
    },
    body: JSON.stringify(body),
  })
  return { response, json: (await response.json()) as Record<string, unknown> }
}

{
  const { response, json } = await request({}, betaKey, {})
  assert.equal(response.status, 400)
  assert.equal(json.error, 'invalid_request')
}
{
  const { response, json } = await request({ enabled: false })
  assert.equal(response.status, 503)
  assert.equal(json.error, 'upstream_execution_disabled')
}
{
  const { response, json } = await request({}, 'wrong-key')
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}
{
  const calls: string[] = []
  const { response, json } = await request({ calls })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(calls, ['load', 'validate', 'claim', 'execute', 'record'])
  assert.equal(json.paymentSent, true)
}
{
  const calls: string[] = []
  const { response, json } = await request({
    calls,
    validationError: new X402UpstreamExecutionError(
      'upstream_budget_exceeded',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'upstream_budget_exceeded')
  assert.deepEqual(calls, ['load', 'validate'])
}
{
  const calls: string[] = []
  const { response, json } = await request({
    calls,
    upstreamError: new Error('network timeout'),
  })
  assert.equal(response.status, 502)
  assert.equal(json.error, 'upstream_execution_result_unknown')
  assert.equal(json.retryAllowed, false)
  assert.deepEqual(calls, [
    'load',
    'validate',
    'claim',
    'execute',
    'record-unknown',
  ])
}
{
  const { response, json } = await request({
    ticketError: new PaymentTicketUpstreamExecutionError(
      'payment_ticket_already_executed',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'payment_ticket_already_executed')
}

console.log('upstream execution route integration tests passed')
