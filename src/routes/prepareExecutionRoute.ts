import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { authenticateBetaAccess } from '../services/betaAccess.js'
import {
  PaymentPreviewError,
  preparePaymentPreview,
  type PaymentPreviewPolicy,
} from '../services/x402PaymentPreview.js'
import type {
  PreparedPaymentTicket,
  BetaExecutionUsage,
  PaymentPreview,
} from '../services/paymentPrepareTickets.js'
import { BetaExecutionQuotaError } from '../services/paymentPrepareTickets.js'

const requestSchema = z.object({
  budget: z.number().positive().max(10),
})

export type PrepareExecutionDependencies = {
  enabled: boolean
  betaExecutionKey?: string
  betaAccessKeys?: string
  maxBudgetUsdc?: number
  dailyRequestLimit?: number
  dailyBudgetUsdc?: number
  policy: PaymentPreviewPolicy
  fetchChallenge: () => Promise<{ status: number; paymentRequired?: string }>
  loadUsage?: (input: {
    betaKeyId: string
    since: Date
  }) => Promise<BetaExecutionUsage>
  savePreparedPayment?: (input: {
    requestId: string
    paymentRequiredHeader: string
    budgetUsdc: number
    preview: PaymentPreview
    betaKeyId?: string
    betaClientLabel?: string
    betaDailyRequestLimit?: number
    betaDailyBudgetUsdc?: number
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

    if (
      !dependencies.betaExecutionKey &&
      !dependencies.betaAccessKeys?.trim()
    ) {
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

    const betaAccess = authenticateBetaAccess({
      candidate: c.req.header('x-beta-key'),
      betaAccessKeys: dependencies.betaAccessKeys,
      betaExecutionKey: dependencies.betaExecutionKey,
      maxBudgetUsdc: dependencies.maxBudgetUsdc ?? 10,
      dailyRequestLimit: dependencies.dailyRequestLimit ?? 25,
      dailyBudgetUsdc: dependencies.dailyBudgetUsdc ?? 0.05,
    })
    if (!betaAccess) {
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
      if (parsed.data.budget > betaAccess.maxBudgetUsdc) {
        return c.json(
          {
            success: false,
            mode: 'prepare-only',
            requestId,
            error: 'beta_budget_exceeded',
            limitUsdc: betaAccess.maxBudgetUsdc,
            paymentSigned: false,
            paymentSent: false,
          },
          403,
        )
      }

      if (dependencies.loadUsage) {
        const since = new Date()
        since.setUTCHours(0, 0, 0, 0)
        const usage = await dependencies.loadUsage({
          betaKeyId: betaAccess.id,
          since,
        })
        if (usage.requestCount >= betaAccess.dailyRequestLimit) {
          return c.json(
            {
              success: false,
              mode: 'prepare-only',
              requestId,
              error: 'beta_daily_request_limit_exceeded',
              limit: betaAccess.dailyRequestLimit,
              usage,
              paymentSigned: false,
              paymentSent: false,
            },
            429,
          )
        }
        if (
          usage.budgetUsdc + parsed.data.budget >
          betaAccess.dailyBudgetUsdc
        ) {
          return c.json(
            {
              success: false,
              mode: 'prepare-only',
              requestId,
              error: 'beta_daily_budget_exceeded',
              limitUsdc: betaAccess.dailyBudgetUsdc,
              usage,
              paymentSigned: false,
              paymentSent: false,
            },
            429,
          )
        }
      }

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
            betaKeyId: betaAccess.id,
            betaClientLabel: betaAccess.label,
            betaDailyRequestLimit: betaAccess.dailyRequestLimit,
            betaDailyBudgetUsdc: betaAccess.dailyBudgetUsdc,
          })
        : undefined

      return c.json({
        success: true,
        mode: 'prepare-only',
        requestId,
        betaAccess: {
          id: betaAccess.id,
          label: betaAccess.label,
        },
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
        error instanceof BetaExecutionQuotaError
          ? error.code
          : error instanceof PaymentPreviewError
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
        error instanceof BetaExecutionQuotaError
          ? 429
          : error instanceof PaymentPreviewError
            ? 403
            : 502,
      )
    }
  })
}
