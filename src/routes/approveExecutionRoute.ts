import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { betaAccessValid } from '../services/betaAccess.js'
import type { ApprovedPaymentTicket } from '../services/paymentPrepareTickets.js'
import { PaymentTicketApprovalError } from '../services/paymentPrepareTickets.js'

const requestSchema = z.object({
  ticketId: z.string().uuid(),
  approvedBy: z.string().trim().min(1).max(120).optional(),
})

export type ApproveExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  approveTicket: (input: {
    ticketId: string
    approvedBy?: string
  }) => Promise<ApprovedPaymentTicket>
  createRequestId?: () => string
}

export function createApproveExecutionRoute(
  dependencies: ApproveExecutionDependencies,
) {
  const createRequestId = dependencies.createRequestId ?? randomUUID

  return new Hono().post('/', async (c) => {
    const requestId = createRequestId()
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => null))

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          mode: 'approval-only',
          requestId,
          error: 'invalid_request',
          paymentSigned: false,
          paymentSent: false,
        },
        400,
      )
    }

    if (!dependencies.enabled) {
      return c.json(
        {
          success: false,
          mode: 'approval-only',
          requestId,
          error: 'payment_prepare_disabled',
          paymentSigned: false,
          paymentSent: false,
        },
        503,
      )
    }

    if (!dependencies.betaExecutionKey) {
      return c.json(
        {
          success: false,
          mode: 'approval-only',
          requestId,
          error: 'beta_access_not_configured',
          paymentSigned: false,
          paymentSent: false,
        },
        503,
      )
    }

    if (
      !betaAccessValid(
        c.req.header('x-beta-key'),
        dependencies.betaExecutionKey,
      )
    ) {
      return c.json(
        {
          success: false,
          mode: 'approval-only',
          requestId,
          error: 'invalid_beta_access',
          paymentSigned: false,
          paymentSent: false,
        },
        401,
      )
    }

    try {
      const ticket = await dependencies.approveTicket(parsed.data)
      return c.json({
        success: true,
        mode: 'approval-only',
        requestId,
        ticket,
        paymentApproved: true,
        paymentSigned: false,
        paymentSent: false,
        note: 'Approval ticket marked APPROVED. No signature or payment was created.',
      })
    } catch (error) {
      const code =
        error instanceof PaymentTicketApprovalError
          ? error.code
          : 'payment_ticket_approval_failed'
      return c.json(
        {
          success: false,
          mode: 'approval-only',
          requestId,
          error: code,
          paymentSigned: false,
          paymentSent: false,
        },
        error instanceof PaymentTicketApprovalError &&
          error.code === 'payment_ticket_not_found'
          ? 404
          : error instanceof PaymentTicketApprovalError
            ? 409
            : 502,
      )
    }
  })
}
