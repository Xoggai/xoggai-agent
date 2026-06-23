import { randomUUID } from 'node:crypto'
import type { PaymentPayload } from '@x402/core/types'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  betaAccessValid,
  type BetaAccessContext,
} from '../services/betaAccess.js'
import {
  PaymentTicketUpstreamExecutionError,
  type ExecutedPaymentTicket,
  type UpstreamExecutionPaymentTicket,
} from '../services/paymentPrepareTickets.js'
import {
  X402UpstreamExecutionError,
  type UpstreamExecutionResult,
} from '../services/x402UpstreamExecution.js'

const requestSchema = z.object({
  ticketId: z.string().uuid(),
  executedBy: z.string().trim().min(1).max(120).optional(),
  executionConfirmation: z.literal('EXECUTE_X402_BASE_SEPOLIA'),
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

export type UpstreamExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  validateBetaAccess?: (candidate: string | undefined) => boolean
  resolveBetaAccess?: (
    candidate: string | undefined,
  ) => BetaAccessContext | undefined
  loadTicket: (input: {
    ticketId: string
    betaKeyId?: string
  }) => Promise<UpstreamExecutionPaymentTicket>
  validateExecution: (
    ticket: UpstreamExecutionPaymentTicket,
    paymentPayload: PaymentPayload,
    executionConfirmation: string,
  ) => void
  claimTicket: (input: {
    ticketId: string
    executedBy?: string
  }) => Promise<void>
  executeUpstream: (
    ticket: UpstreamExecutionPaymentTicket,
    paymentPayload: PaymentPayload,
    executionConfirmation: string,
  ) => Promise<UpstreamExecutionResult>
  recordExecution: (input: {
    ticketId: string
    success: boolean
    unknown?: boolean
    statusCode?: number
    errorMessage?: string
    responseHash?: string
    paymentResponseHash?: string
    settlementTransaction?: string
    settlementNetwork?: string
    settlementResultHash?: string
  }) => Promise<ExecutedPaymentTicket>
  createRequestId?: () => string
}

export function createUpstreamExecutionRoute(
  dependencies: UpstreamExecutionDependencies,
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
          mode: 'upstream-execution',
          requestId,
          error: 'invalid_request',
          paymentSent: false,
        },
        400,
      )
    }
    if (!dependencies.enabled) {
      return c.json(
        {
          success: false,
          mode: 'upstream-execution',
          requestId,
          error: 'upstream_execution_disabled',
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
          mode: 'upstream-execution',
          requestId,
          error: 'beta_access_not_configured',
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
          mode: 'upstream-execution',
          requestId,
          error: 'invalid_beta_access',
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
      dependencies.validateExecution(
        ticket,
        paymentPayload,
        parsed.data.executionConfirmation,
      )
      await dependencies.claimTicket({
        ticketId: parsed.data.ticketId,
        executedBy: parsed.data.executedBy,
      })
      claimed = true

      const upstream = await dependencies.executeUpstream(
        { ...ticket, status: 'UPSTREAM_EXECUTING' },
        paymentPayload,
        parsed.data.executionConfirmation,
      )
      const auditTicket = await dependencies.recordExecution({
        ticketId: parsed.data.ticketId,
        success: upstream.success,
        statusCode: upstream.statusCode,
        responseHash: upstream.responseHash,
        paymentResponseHash: upstream.paymentResponseHash,
        settlementTransaction: upstream.settlement?.transaction,
        settlementNetwork: upstream.settlement?.network,
        settlementResultHash: upstream.paymentResponseHash,
        errorMessage:
          upstream.settlement?.errorMessage ?? upstream.settlement?.errorReason,
      })

      return c.json({
        success: upstream.success,
        mode: 'upstream-execution',
        requestId,
        ticket: auditTicket,
        upstream: {
          statusCode: upstream.statusCode,
          responseHash: upstream.responseHash,
          responsePreview: upstream.responsePreview,
        },
        settlement: upstream.settlement,
        paymentSent: upstream.success,
        note: upstream.success
          ? 'Paid upstream x402 resource returned a settlement response.'
          : 'Upstream execution failed. No automatic retry will occur.',
      })
    } catch (error) {
      let unknownTicket: ExecutedPaymentTicket | undefined
      if (claimed) {
        unknownTicket = await dependencies
          .recordExecution({
            ticketId: parsed.data.ticketId,
            success: false,
            unknown: true,
            errorMessage:
              error instanceof Error ? error.message : 'unknown_error',
          })
          .catch(() => undefined)
      }
      const code =
        error instanceof PaymentTicketUpstreamExecutionError ||
        error instanceof X402UpstreamExecutionError
          ? error.code
          : claimed
            ? 'upstream_execution_result_unknown'
            : 'upstream_execution_failed'

      return c.json(
        {
          success: false,
          mode: 'upstream-execution',
          requestId,
          error: code,
          ...(unknownTicket ? { ticket: unknownTicket } : {}),
          paymentSent: false,
          retryAllowed: false,
        },
        error instanceof PaymentTicketUpstreamExecutionError &&
          error.code === 'payment_ticket_not_found'
          ? 404
          : error instanceof PaymentTicketUpstreamExecutionError ||
              error instanceof X402UpstreamExecutionError
            ? 409
            : 502,
      )
    }
  })
}
