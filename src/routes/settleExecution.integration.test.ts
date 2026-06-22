import assert from 'node:assert/strict'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import {
  PaymentTicketSettlementError,
  type SettlementPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import {
  PaymentSettlementError,
  type PaymentSettlementResult,
} from '../services/x402PaymentSettlement.js'
import { createSettleExecutionRoute } from './settleExecutionRoute.js'

const betaKey = 'beta-key-for-settle-route-tests-32-characters'
const ticketId = '11111111-1111-4111-8111-111111111111'
const ticket: SettlementPaymentTicket = {
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
    ticketError: PaymentTicketSettlementError
    validationError: PaymentSettlementError
    settlementError: Error
    settlementResponse: PaymentSettlementResult['response']
    calls: string[]
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/settle',
    createSettleExecutionRoute({
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
      validateSettlement() {
        overrides.calls?.push('validate')
        if (overrides.validationError) throw overrides.validationError
      },
      async claimTicket() {
        overrides.calls?.push('claim')
      },
      async settlePayment() {
        overrides.calls?.push('settle')
        if (overrides.settlementError) throw overrides.settlementError
        return {
          facilitatorUrl: 'https://x402.org/facilitator',
          resultHash: 'b'.repeat(64),
          response:
            overrides.settlementResponse ??
            ({
              success: true,
              payer: ticket.signerAddress,
              transaction: `0x${'c'.repeat(64)}`,
              network: 'eip155:84532',
            } satisfies PaymentSettlementResult['response']),
        }
      },
      async recordSettlement(input) {
        overrides.calls?.push(
          input.unknown ? 'record-unknown' : 'record',
        )
        return {
          id: ticketId,
          status: input.success
            ? 'SETTLED'
            : input.unknown
              ? 'SETTLEMENT_UNKNOWN'
              : 'SETTLEMENT_FAILED',
          settlementStatus: input.success
            ? 'SUCCESS'
            : input.unknown
              ? 'UNKNOWN'
              : 'FAILED',
          ...(input.transaction
            ? { settlementTransaction: input.transaction }
            : {}),
          ...(input.network ? { settlementNetwork: input.network } : {}),
          ...(input.errorReason
            ? { settlementErrorReason: input.errorReason }
            : {}),
          settledAt: '2026-06-20T12:00:50.000Z',
        }
      },
      createRequestId: () => 'settle-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = {
    ticketId,
    settledBy: 'operator',
    settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
    paymentPayload,
  },
) {
  const response = await createApp(overrides).request('/execute/settle', {
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
  assert.equal(json.error, 'payment_settlement_disabled')
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
  assert.deepEqual(calls, ['load', 'validate', 'claim', 'settle', 'record'])
  assert.equal(json.paymentSettled, true)
  assert.equal(json.paymentSent, true)
}
{
  const calls: string[] = []
  const { response, json } = await request({
    calls,
    settlementResponse: {
      success: false,
      errorReason: 'insufficient_funds',
      errorMessage: 'simulation failed',
      transaction: '',
      network: 'eip155:84532',
    },
  })
  assert.equal(response.status, 200)
  assert.equal(json.paymentSettled, false)
  assert.equal(json.paymentSent, false)
  assert.deepEqual(calls, ['load', 'validate', 'claim', 'settle', 'record'])
}
{
  const calls: string[] = []
  const { response, json } = await request({
    calls,
    validationError: new PaymentSettlementError(
      'settlement_budget_exceeded',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'settlement_budget_exceeded')
  assert.deepEqual(calls, ['load', 'validate'])
}
{
  const calls: string[] = []
  const { response, json } = await request({
    calls,
    settlementError: new Error('network timeout'),
  })
  assert.equal(response.status, 502)
  assert.equal(json.error, 'settlement_result_unknown')
  assert.equal(json.retryAllowed, false)
  assert.deepEqual(calls, [
    'load',
    'validate',
    'claim',
    'settle',
    'record-unknown',
  ])
}
{
  const { response, json } = await request({
    ticketError: new PaymentTicketSettlementError(
      'payment_ticket_already_settled',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'payment_ticket_already_settled')
}

console.log('settle execution route integration tests passed')
