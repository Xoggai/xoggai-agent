import assert from 'node:assert/strict'
import { Hono } from 'hono'
import {
  PaymentTicketConsumeError,
  type ConsumedPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import { createConsumeExecutionRoute } from './consumeExecutionRoute.js'

const betaKey = 'beta-key-for-consume-route-tests'
const ticketId = '11111111-1111-4111-8111-111111111111'

function createApp(
  overrides: Partial<{
    enabled: boolean
    betaExecutionKey: string | undefined
    consumeError: PaymentTicketConsumeError
    consumedInputs: Array<{ ticketId: string; consumedBy?: string }>
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/consume',
    createConsumeExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      async consumeTicket(input) {
        if (overrides.consumeError) {
          throw overrides.consumeError
        }
        overrides.consumedInputs?.push(input)
        return {
          id: input.ticketId,
          status: 'CONSUMED',
          challengeHash:
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          consumedAt: '2026-06-20T12:00:30.000Z',
          expiresAt: '2026-06-20T12:01:00.000Z',
        } satisfies ConsumedPaymentTicket
      },
      createRequestId: () => 'consume-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = { ticketId, consumedBy: 'operator' },
) {
  const response = await createApp(overrides).request('/execute/consume', {
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
  assert.equal(json.error, 'payment_prepare_disabled')
}

{
  const { response, json } = await request({}, 'wrong-key')
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}

{
  const consumedInputs: Array<{ ticketId: string; consumedBy?: string }> = []
  const { response, json } = await request({ consumedInputs })
  assert.equal(response.status, 200)
  assert.equal(json.success, true)
  assert.equal(json.mode, 'consume-only')
  assert.equal(json.paymentConsumed, true)
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
  assert.deepEqual(consumedInputs, [{ ticketId, consumedBy: 'operator' }])
}

{
  const { response, json } = await request({
    consumeError: new PaymentTicketConsumeError('payment_ticket_expired'),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'payment_ticket_expired')
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

{
  const { response, json } = await request({
    consumeError: new PaymentTicketConsumeError('payment_ticket_not_found'),
  })
  assert.equal(response.status, 404)
  assert.equal(json.error, 'payment_ticket_not_found')
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

console.log('consume execution route integration tests passed')
