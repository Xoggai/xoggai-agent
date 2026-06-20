import assert from 'node:assert/strict'
import { Hono } from 'hono'
import {
  PaymentTicketApprovalError,
  type ApprovedPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import { createApproveExecutionRoute } from './approveExecutionRoute.js'

const betaKey = 'beta-key-for-approval-route-tests'
const ticketId = '11111111-1111-4111-8111-111111111111'

function createApp(
  overrides: Partial<{
    enabled: boolean
    betaExecutionKey: string | undefined
    approvalError: PaymentTicketApprovalError
    approvedInputs: Array<{ ticketId: string; approvedBy?: string }>
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/approve',
    createApproveExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      async approveTicket(input) {
        if (overrides.approvalError) {
          throw overrides.approvalError
        }
        overrides.approvedInputs?.push(input)
        return {
          id: input.ticketId,
          status: 'APPROVED',
          challengeHash:
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          approvedAt: '2026-06-20T12:00:00.000Z',
          expiresAt: '2026-06-20T12:01:00.000Z',
        } satisfies ApprovedPaymentTicket
      },
      createRequestId: () => 'approve-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = { ticketId, approvedBy: 'operator' },
) {
  const response = await createApp(overrides).request('/execute/approve', {
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
  const approvedInputs: Array<{ ticketId: string; approvedBy?: string }> = []
  const { response, json } = await request({ approvedInputs })
  assert.equal(response.status, 200)
  assert.equal(json.success, true)
  assert.equal(json.mode, 'approval-only')
  assert.equal(json.paymentApproved, true)
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
  assert.deepEqual(approvedInputs, [{ ticketId, approvedBy: 'operator' }])
}

{
  const { response, json } = await request({
    approvalError: new PaymentTicketApprovalError('payment_ticket_expired'),
  })
  assert.equal(response.status, 409)
  assert.equal(json.error, 'payment_ticket_expired')
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

{
  const { response, json } = await request({
    approvalError: new PaymentTicketApprovalError('payment_ticket_not_found'),
  })
  assert.equal(response.status, 404)
  assert.equal(json.error, 'payment_ticket_not_found')
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

console.log('approve execution route integration tests passed')
