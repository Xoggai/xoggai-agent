import assert from 'node:assert/strict'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import {
  PaymentTicketVerificationError,
  type VerifiablePaymentTicket,
} from '../services/paymentPrepareTickets.js'
import {
  PaymentVerificationError,
  type PaymentVerificationResult,
} from '../services/x402PaymentVerification.js'
import { createVerifyExecutionRoute } from './verifyExecutionRoute.js'

const betaKey = 'beta-key-for-verify-route-tests-32-characters'
const ticketId = '11111111-1111-4111-8111-111111111111'
const ticket: VerifiablePaymentTicket = {
  id: ticketId,
  status: 'SIGNED',
  challengeHash:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  resourceUrl: 'https://example.test/paid',
  network: 'eip155:84532',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  assetName: 'USDC',
  assetVersion: '2',
  recipient: '0xd275612Bf0BB35638432c4D95eAA8D5d22346Ca6',
  amountAtomic: '2000',
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
    ticketError: PaymentTicketVerificationError
    verificationError: PaymentVerificationError | Error
    verifyResponse: PaymentVerificationResult['response']
    recordedInputs: Array<Record<string, unknown>>
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/verify',
    createVerifyExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      async loadTicket() {
        if (overrides.ticketError) throw overrides.ticketError
        return ticket
      },
      async verifyPayment() {
        if (overrides.verificationError) throw overrides.verificationError
        return {
          facilitatorUrl: 'https://x402.org/facilitator',
          resultHash: 'b'.repeat(64),
          response:
            overrides.verifyResponse ??
            ({
              isValid: true,
              payer: ticket.signerAddress,
            } satisfies PaymentVerificationResult['response']),
        }
      },
      async recordVerification(input) {
        overrides.recordedInputs?.push(input)
        return {
          id: ticketId,
          status: input.isValid ? 'VERIFIED' : 'SIGNED',
          verificationStatus: input.isValid ? 'VALID' : 'INVALID',
          ...(input.invalidReason
            ? { verificationReason: input.invalidReason }
            : {}),
          ...(input.payer ? { verificationPayer: input.payer } : {}),
          verificationResultHash: input.resultHash,
          facilitatorUrl: input.facilitatorUrl,
          verifiedAt: '2026-06-20T12:00:40.000Z',
          expiresAt: ticket.expiresAt,
        }
      },
      createRequestId: () => 'verify-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = {
    ticketId,
    verifiedBy: 'operator',
    paymentPayload,
  },
) {
  const response = await createApp(overrides).request('/execute/verify', {
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
  assert.equal(json.error, 'payment_verification_disabled')
}
{
  const { response, json } = await request({}, 'wrong-key')
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}
{
  const recordedInputs: Array<Record<string, unknown>> = []
  const { response, json } = await request({ recordedInputs })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(json.mode, 'verify-only')
  assert.equal(json.verificationCompleted, true)
  assert.equal(json.paymentVerified, true)
  assert.equal(json.paymentSettled, false)
  assert.equal(json.paymentSent, false)
  assert.equal(recordedInputs[0]?.verifiedBy, 'operator')
}
{
  const recordedInputs: Array<Record<string, unknown>> = []
  const { response, json } = await request({
    recordedInputs,
    verifyResponse: {
      isValid: false,
      invalidReason: 'insufficient_funds',
      payer: ticket.signerAddress,
    },
  })
  assert.equal(response.status, 200)
  assert.equal(json.paymentVerified, false)
  assert.equal(json.paymentSettled, false)
  assert.equal(recordedInputs[0]?.isValid, false)
}
{
  const { response, json } = await request({
    ticketError: new PaymentTicketVerificationError(
      'payment_ticket_not_signed',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'payment_ticket_not_signed')
}
{
  const { response, json } = await request({
    verificationError: new PaymentVerificationError(
      'verification_payload_mismatch',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'verification_payload_mismatch')
  assert.equal(json.paymentSettled, false)
  assert.equal(json.paymentSent, false)
}

console.log('verify execution route integration tests passed')
