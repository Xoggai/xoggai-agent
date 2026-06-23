import { randomUUID } from 'node:crypto'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  betaAccessValid,
  type BetaAccessContext,
} from '../services/betaAccess.js'
import {
  PaymentTicketSigningError,
  type SignablePaymentTicket,
  type SignedPaymentTicket,
} from '../services/paymentPrepareTickets.js'

const requestSchema = z.object({
  ticketId: z.string().uuid(),
  signedBy: z.string().trim().min(1).max(120).optional(),
})

export type SignExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  validateBetaAccess?: (candidate: string | undefined) => boolean
  resolveBetaAccess?: (
    candidate: string | undefined,
  ) => BetaAccessContext | undefined
  loadTicket: (input: {
    ticketId: string
    betaKeyId?: string
  }) => Promise<SignablePaymentTicket>
  signPayment: (ticket: SignablePaymentTicket) => Promise<{
    signerAddress: string
    signatureHash: string
    paymentPayload: PaymentPayload
  }>
  markSigned: (input: {
    ticketId: string
    signerAddress: string
    signatureHash: string
    signedBy?: string
  }) => Promise<SignedPaymentTicket>
  createRequestId?: () => string
}

export function createSignExecutionRoute(
  dependencies: SignExecutionDependencies,
) {
  const createRequestId = dependencies.createRequestId ?? randomUUID

  return new Hono().post('/', async (c) => {
    c.header('Cache-Control', 'no-store')
    c.header('Pragma', 'no-cache')
    const requestId = createRequestId()
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => null))

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          mode: 'sign-only',
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
          mode: 'sign-only',
          requestId,
          error: 'payment_signing_disabled',
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
          mode: 'sign-only',
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
          mode: 'sign-only',
          requestId,
          error: 'invalid_beta_access',
          paymentSigned: false,
          paymentSent: false,
        },
        401,
      )
    }

    try {
      const consumedTicket = await dependencies.loadTicket({
        ticketId: parsed.data.ticketId,
        betaKeyId: access?.id,
      })
      const credential = await dependencies.signPayment(consumedTicket)
      const ticket = await dependencies.markSigned({
        ticketId: parsed.data.ticketId,
        signerAddress: credential.signerAddress,
        signatureHash: credential.signatureHash,
        signedBy: parsed.data.signedBy,
      })

      return c.json({
        success: true,
        mode: 'sign-only',
        requestId,
        ticket,
        credential,
        paymentSigned: true,
        paymentSent: false,
        note: 'Payment credential created in memory. No paid request or transaction was sent.',
      })
    } catch (error) {
      const code =
        error instanceof PaymentTicketSigningError
          ? error.code
          : 'payment_signing_failed'
      return c.json(
        {
          success: false,
          mode: 'sign-only',
          requestId,
          error: code,
          paymentSigned: false,
          paymentSent: false,
        },
        error instanceof PaymentTicketSigningError &&
          error.code === 'payment_ticket_not_found'
          ? 404
          : error instanceof PaymentTicketSigningError
            ? 409
            : 502,
      )
    }
  })
}
