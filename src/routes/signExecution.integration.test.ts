import assert from 'node:assert/strict'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import {
  PaymentTicketSigningError,
  type SignablePaymentTicket,
} from '../services/paymentPrepareTickets.js'
import { createSignExecutionRoute } from './signExecutionRoute.js'

const betaKey = 'beta-key-for-sign-route-tests-32-characters'
const ticketId = '11111111-1111-4111-8111-111111111111'
const consumedTicket: SignablePaymentTicket = {
  id: ticketId,
  status: 'CONSUMED',
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
  expiresAt: '2026-06-20T12:01:00.000Z',
}
const paymentPayload = {
  x402Version: 2,
  resource: { url: consumedTicket.resourceUrl },
  accepted: {
    scheme: 'exact',
    network: consumedTicket.network,
    asset: consumedTicket.asset,
    amount: consumedTicket.amountAtomic,
    payTo: consumedTicket.recipient,
    maxTimeoutSeconds: 60,
    extra: { name: 'USDC', version: '2' },
  },
  payload: {
    signature: '0x1234',
    authorization: { from: '0x0000000000000000000000000000000000000001' },
  },
  extensions: {},
} as PaymentPayload

function createApp(
  overrides: Partial<{
    enabled: boolean
    betaExecutionKey: string | undefined
    loadError: PaymentTicketSigningError
    signError: Error
    markedInputs: Array<Record<string, unknown>>
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/sign',
    createSignExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      async loadTicket() {
        if (overrides.loadError) throw overrides.loadError
        return consumedTicket
      },
      async signPayment() {
        if (overrides.signError) throw overrides.signError
        return {
          signerAddress: '0x0000000000000000000000000000000000000001',
          signatureHash: 'a'.repeat(64),
          paymentPayload,
        }
      },
      async markSigned(input) {
        overrides.markedInputs?.push(input)
        return {
          id: ticketId,
          status: 'SIGNED',
          challengeHash: consumedTicket.challengeHash,
          signerAddress: input.signerAddress,
          signatureHash: input.signatureHash,
          signedAt: '2026-06-20T12:00:45.000Z',
          expiresAt: consumedTicket.expiresAt,
        }
      },
      createRequestId: () => 'sign-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = { ticketId, signedBy: 'operator' },
) {
  const response = await createApp(overrides).request('/execute/sign', {
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
  assert.equal(json.error, 'payment_signing_disabled')
}
{
  const { response, json } = await request({}, 'wrong-key')
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}
{
  const markedInputs: Array<Record<string, unknown>> = []
  const { response, json } = await request({ markedInputs })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(json.mode, 'sign-only')
  assert.equal(json.paymentSigned, true)
  assert.equal(json.paymentSent, false)
  assert.equal((json.ticket as Record<string, unknown>).status, 'SIGNED')
  assert.equal(markedInputs[0]?.signedBy, 'operator')
}
{
  const { response, json } = await request({
    loadError: new PaymentTicketSigningError(
      'payment_ticket_already_signed',
    ),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'payment_ticket_already_signed')
  assert.equal(json.paymentSent, false)
}
{
  const { response, json } = await request({
    signError: new Error('wallet failure'),
  })
  assert.equal(response.status, 502)
  assert.equal(json.error, 'payment_signing_failed')
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

console.log('sign execution route integration tests passed')
