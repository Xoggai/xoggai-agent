import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  betaAccessValid,
  type BetaAccessContext,
} from '../services/betaAccess.js'
import type { ConsumedPaymentTicket } from '../services/paymentPrepareTickets.js'
import { PaymentTicketConsumeError } from '../services/paymentPrepareTickets.js'

const requestSchema = z.object({
  ticketId: z.string().uuid(),
  consumedBy: z.string().trim().min(1).max(120).optional(),
})

export type ConsumeExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  validateBetaAccess?: (candidate: string | undefined) => boolean
  resolveBetaAccess?: (
    candidate: string | undefined,
  ) => BetaAccessContext | undefined
  consumeTicket: (input: {
    ticketId: string
    consumedBy?: string
    betaKeyId?: string
  }) => Promise<ConsumedPaymentTicket>
  createRequestId?: () => string
}

export function createConsumeExecutionRoute(
  dependencies: ConsumeExecutionDependencies,
) {
  const createRequestId = dependencies.createRequestId ?? randomUUID

  return new Hono().post('/', async (c) => {
    const requestId = createRequestId()
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => null))

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          mode: 'consume-only',
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
          mode: 'consume-only',
          requestId,
          error: 'payment_prepare_disabled',
          paymentSigned: false,
          paymentSent: false,
        },
        503,
      )
    }

    if (
      !dependencies.betaExecutionKey &&
      !dependencies.validateBetaAccess &&
      !dependencies.resolveBetaAccess
    ) {
      return c.json(
        {
          success: false,
          mode: 'consume-only',
          requestId,
          error: 'beta_access_not_configured',
          paymentSigned: false,
          paymentSent: false,
        },
        503,
      )
    }

    const access = dependencies.resolveBetaAccess?.(
      c.req.header('x-beta-key'),
    )
    const accessValid = access
      ? true
      : dependencies.validateBetaAccess
      ? dependencies.validateBetaAccess(c.req.header('x-beta-key'))
      : betaAccessValid(
          c.req.header('x-beta-key'),
          dependencies.betaExecutionKey,
        )
    if (!accessValid) {
      return c.json(
        {
          success: false,
          mode: 'consume-only',
          requestId,
          error: 'invalid_beta_access',
          paymentSigned: false,
          paymentSent: false,
        },
        401,
      )
    }

    try {
      const ticket = await dependencies.consumeTicket({
        ...parsed.data,
        ...(access ? { betaKeyId: access.id } : {}),
      })
      return c.json({
        success: true,
        mode: 'consume-only',
        requestId,
        ticket,
        paymentConsumed: true,
        paymentSigned: false,
        paymentSent: false,
        note: 'Approval ticket marked CONSUMED. No signature or payment was created.',
      })
    } catch (error) {
      const code =
        error instanceof PaymentTicketConsumeError
          ? error.code
          : 'payment_ticket_consume_failed'
      return c.json(
        {
          success: false,
          mode: 'consume-only',
          requestId,
          error: code,
          paymentSigned: false,
          paymentSent: false,
        },
        error instanceof PaymentTicketConsumeError &&
          error.code === 'payment_ticket_not_found'
          ? 404
          : error instanceof PaymentTicketConsumeError
            ? 409
            : 502,
      )
    }
  })
}
