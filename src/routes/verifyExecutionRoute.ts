import { randomUUID } from 'node:crypto'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import { z } from 'zod'
import { betaAccessValid } from '../services/betaAccess.js'
import {
  PaymentTicketVerificationError,
  type VerifiablePaymentTicket,
  type VerifiedPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import {
  PaymentVerificationError,
  type PaymentVerificationResult,
} from '../services/x402PaymentVerification.js'

const requestSchema = z.object({
  ticketId: z.string().uuid(),
  verifiedBy: z.string().trim().min(1).max(120).optional(),
  paymentPayload: z
    .object({
      x402Version: z.number().int(),
      accepted: z.object({}).passthrough(),
      payload: z.object({}).passthrough(),
      resource: z.object({ url: z.string().url() }).optional(),
      extensions: z.object({}).passthrough().optional(),
    })
    .passthrough(),
})

export type VerifyExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  loadTicket: (input: {
    ticketId: string
  }) => Promise<VerifiablePaymentTicket>
  verifyPayment: (
    ticket: VerifiablePaymentTicket,
    paymentPayload: PaymentPayload,
  ) => Promise<PaymentVerificationResult>
  recordVerification: (input: {
    ticketId: string
    isValid: boolean
    invalidReason?: string
    payer?: string
    resultHash: string
    facilitatorUrl: string
    verifiedBy?: string
  }) => Promise<VerifiedPaymentTicket>
  createRequestId?: () => string
}

export function createVerifyExecutionRoute(
  dependencies: VerifyExecutionDependencies,
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
          mode: 'verify-only',
          requestId,
          error: 'invalid_request',
          paymentVerified: false,
          paymentSettled: false,
          paymentSent: false,
        },
        400,
      )
    }
    if (!dependencies.enabled) {
      return c.json(
        {
          success: false,
          mode: 'verify-only',
          requestId,
          error: 'payment_verification_disabled',
          paymentVerified: false,
          paymentSettled: false,
          paymentSent: false,
        },
        503,
      )
    }
    if (!dependencies.betaExecutionKey) {
      return c.json(
        {
          success: false,
          mode: 'verify-only',
          requestId,
          error: 'beta_access_not_configured',
          paymentVerified: false,
          paymentSettled: false,
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
          mode: 'verify-only',
          requestId,
          error: 'invalid_beta_access',
          paymentVerified: false,
          paymentSettled: false,
          paymentSent: false,
        },
        401,
      )
    }

    try {
      const ticket = await dependencies.loadTicket({
        ticketId: parsed.data.ticketId,
      })
      const verification = await dependencies.verifyPayment(
        ticket,
        parsed.data.paymentPayload as PaymentPayload,
      )
      const auditTicket = await dependencies.recordVerification({
        ticketId: parsed.data.ticketId,
        isValid: verification.response.isValid,
        invalidReason: verification.response.invalidReason,
        payer: verification.response.payer,
        resultHash: verification.resultHash,
        facilitatorUrl: verification.facilitatorUrl,
        verifiedBy: parsed.data.verifiedBy,
      })

      return c.json({
        success: true,
        mode: 'verify-only',
        requestId,
        ticket: auditTicket,
        verification: verification.response,
        verificationCompleted: true,
        paymentVerified: verification.response.isValid,
        paymentSettled: false,
        paymentSent: false,
        note: verification.response.isValid
          ? 'Credential verified by the facilitator. Settlement was not requested.'
          : 'Facilitator completed verification and rejected the credential. Settlement was not requested.',
      })
    } catch (error) {
      const code =
        error instanceof PaymentTicketVerificationError ||
        error instanceof PaymentVerificationError
          ? error.code
          : 'payment_verification_failed'
      return c.json(
        {
          success: false,
          mode: 'verify-only',
          requestId,
          error: code,
          paymentVerified: false,
          paymentSettled: false,
          paymentSent: false,
        },
        error instanceof PaymentTicketVerificationError &&
          error.code === 'payment_ticket_not_found'
          ? 404
          : error instanceof PaymentTicketVerificationError ||
              error instanceof PaymentVerificationError
            ? 409
            : 502,
      )
    }
  })
}
