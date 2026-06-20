import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { betaAccessValid } from '../services/betaAccess.js'
import {
  PaymentPreviewError,
  preparePaymentPreview,
  type PaymentPreviewPolicy,
} from '../services/x402PaymentPreview.js'
import type {
  PreparedPaymentTicket,
  PaymentPreview,
} from '../services/paymentPrepareTickets.js'

const requestSchema = z.object({
  budget: z.number().positive().max(10),
})

export type PrepareExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  policy: PaymentPreviewPolicy
  fetchChallenge: () => Promise<{ status: number; paymentRequired?: string }>
  savePreparedPayment?: (input: {
    requestId: string
    paymentRequiredHeader: string
    budgetUsdc: number
    preview: PaymentPreview
  }) => Promise<PreparedPaymentTicket>
  createRequestId?: () => string
}

export function createPrepareExecutionRoute(
  dependencies: PrepareExecutionDependencies,
) {
  const createRequestId = dependencies.createRequestId ?? randomUUID

  return new Hono().post('/', async (c) => {
    const requestId = createRequestId()
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => null))

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          mode: 'prepare-only',
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
          mode: 'prepare-only',
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
          mode: 'prepare-only',
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
          mode: 'prepare-only',
          requestId,
          error: 'invalid_beta_access',
          paymentSigned: false,
          paymentSent: false,
        },
        401,
      )
    }

    try {
      const challenge = await dependencies.fetchChallenge()
      if (challenge.status !== 402 || !challenge.paymentRequired) {
        return c.json(
          {
            success: false,
            mode: 'prepare-only',
            requestId,
            error: 'upstream_payment_challenge_missing',
            upstreamStatus: challenge.status,
            paymentSigned: false,
            paymentSent: false,
          },
          502,
        )
      }

      const preview = preparePaymentPreview(
        challenge.paymentRequired,
        parsed.data.budget,
        dependencies.policy,
      )
      const ticket = dependencies.savePreparedPayment
        ? await dependencies.savePreparedPayment({
            requestId,
            paymentRequiredHeader: challenge.paymentRequired,
            budgetUsdc: parsed.data.budget,
            preview,
          })
        : undefined

      return c.json({
        success: true,
        mode: 'prepare-only',
        requestId,
        budgetUsdc: parsed.data.budget,
        preview,
        ticket,
        paymentPrepared: true,
        paymentSigned: false,
        paymentSent: false,
        note: ticket
          ? 'Challenge validated and approval ticket created. No signature or payment was created.'
          : 'Challenge validated. No signature or payment was created.',
      })
    } catch (error) {
      const code =
        error instanceof PaymentPreviewError
          ? error.code
          : error instanceof Error &&
              error.message === 'payment_prepare_ticket_not_created'
            ? 'payment_prepare_ticket_not_created'
            : 'upstream_challenge_unreachable'
      return c.json(
        {
          success: false,
          mode: 'prepare-only',
          requestId,
          error: code,
          paymentSigned: false,
          paymentSent: false,
        },
        error instanceof PaymentPreviewError ? 403 : 502,
      )
    }
  })
}
