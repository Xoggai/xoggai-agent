import { randomUUID } from 'node:crypto'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  betaAccessValid,
  type BetaAccessContext,
} from '../services/betaAccess.js'
import {
  PaymentTicketSettlementError,
  type SettlementPaymentTicket,
  type SettledPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import {
  PaymentSettlementError,
  type PaymentSettlementResult,
} from '../services/x402PaymentSettlement.js'

const requestSchema = z.object({
  ticketId: z.string().uuid(),
  settledBy: z.string().trim().min(1).max(120).optional(),
  settlementConfirmation: z.literal('SETTLE_BASE_SEPOLIA'),
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

export type SettleExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  validateBetaAccess?: (candidate: string | undefined) => boolean
  resolveBetaAccess?: (
    candidate: string | undefined,
  ) => BetaAccessContext | undefined
  loadTicket: (input: {
    ticketId: string
    betaKeyId?: string
  }) => Promise<SettlementPaymentTicket>
  validateSettlement: (
    ticket: SettlementPaymentTicket,
    paymentPayload: PaymentPayload,
    settlementConfirmation: string,
  ) => void
  claimTicket: (input: {
    ticketId: string
    settledBy?: string
  }) => Promise<void>
  settlePayment: (
    ticket: SettlementPaymentTicket,
    paymentPayload: PaymentPayload,
    settlementConfirmation: string,
  ) => Promise<PaymentSettlementResult>
  recordSettlement: (input: {
    ticketId: string
    success: boolean
    unknown?: boolean
    errorReason?: string
    errorMessage?: string
    transaction?: string
    network?: string
    resultHash?: string
  }) => Promise<SettledPaymentTicket>
  createRequestId?: () => string
}

export function createSettleExecutionRoute(
  dependencies: SettleExecutionDependencies,
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
          mode: 'settlement',
          requestId,
          error: 'invalid_request',
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
          mode: 'settlement',
          requestId,
          error: 'payment_settlement_disabled',
          paymentSettled: false,
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
          mode: 'settlement',
          requestId,
          error: 'beta_access_not_configured',
          paymentSettled: false,
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
          mode: 'settlement',
          requestId,
          error: 'invalid_beta_access',
          paymentSettled: false,
          paymentSent: false,
        },
        401,
      )
    }

    let claimed = false
    try {
      const ticket = await dependencies.loadTicket({
        ticketId: parsed.data.ticketId,
        betaKeyId: access?.id,
      })
      const paymentPayload = parsed.data.paymentPayload as PaymentPayload
      dependencies.validateSettlement(
        ticket,
        paymentPayload,
        parsed.data.settlementConfirmation,
      )
      await dependencies.claimTicket({
        ticketId: parsed.data.ticketId,
        settledBy: parsed.data.settledBy,
      })
      claimed = true

      const settlement = await dependencies.settlePayment(
        { ...ticket, status: 'SETTLING' },
        paymentPayload,
        parsed.data.settlementConfirmation,
      )
      const auditTicket = await dependencies.recordSettlement({
        ticketId: parsed.data.ticketId,
        success: settlement.response.success,
        errorReason: settlement.response.errorReason,
        errorMessage: settlement.response.errorMessage,
        transaction: settlement.response.transaction,
        network: settlement.response.network,
        resultHash: settlement.resultHash,
      })

      return c.json({
        success: settlement.response.success,
        mode: 'settlement',
        requestId,
        ticket: auditTicket,
        settlement: settlement.response,
        paymentSettled: settlement.response.success,
        paymentSent: settlement.response.success,
        note: settlement.response.success
          ? 'Base Sepolia payment settled by the facilitator.'
          : 'Facilitator rejected settlement. No automatic retry will occur.',
      })
    } catch (error) {
      let unknownTicket: SettledPaymentTicket | undefined
      if (claimed) {
        unknownTicket = await dependencies
          .recordSettlement({
            ticketId: parsed.data.ticketId,
            success: false,
            unknown: true,
            errorReason: 'settlement_result_unknown',
            errorMessage:
              error instanceof Error ? error.message : 'unknown_error',
          })
          .catch(() => undefined)
      }
      const code =
        error instanceof PaymentTicketSettlementError ||
        error instanceof PaymentSettlementError
          ? error.code
          : claimed
            ? 'settlement_result_unknown'
            : 'payment_settlement_failed'
      return c.json(
        {
          success: false,
          mode: 'settlement',
          requestId,
          error: code,
          ...(unknownTicket ? { ticket: unknownTicket } : {}),
          paymentSettled: false,
          paymentSent: false,
          retryAllowed: false,
        },
        error instanceof PaymentTicketSettlementError &&
          error.code === 'payment_ticket_not_found'
          ? 404
          : error instanceof PaymentTicketSettlementError ||
              error instanceof PaymentSettlementError
            ? 409
            : 502,
      )
    }
  })
}
