import { createHash } from 'node:crypto'
import { HTTPFacilitatorClient } from '@x402/core/http'
import { SettleError } from '@x402/core/types'
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from '@x402/core/types'
import type { SettlementPaymentTicket } from './paymentPrepareTickets.js'
import { assertPaymentPayloadMatchesTicket } from './x402PaymentVerification.js'

export class PaymentSettlementError extends Error {
  constructor(
    public readonly code:
      | 'settlement_network_not_allowed'
      | 'settlement_facilitator_not_allowed'
      | 'settlement_budget_exceeded'
      | 'settlement_confirmation_required',
  ) {
    super(code)
  }
}

export type PaymentSettlementResult = {
  facilitatorUrl: string
  resultHash: string
  response: SettleResponse
}

async function settleWithTimeout(
  facilitator: Pick<HTTPFacilitatorClient, 'settle'>,
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
) {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      facilitator.settle(paymentPayload, requirements),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('facilitator_settlement_timeout')),
          30_000,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function assertSettlementRequest({
  ticket,
  paymentPayload,
  facilitatorUrl,
  maxBudgetUsdc,
  settlementConfirmation,
}: {
  ticket: SettlementPaymentTicket
  paymentPayload: PaymentPayload
  facilitatorUrl: string
  maxBudgetUsdc: number
  settlementConfirmation: string
}) {
  if (settlementConfirmation !== 'SETTLE_BASE_SEPOLIA') {
    throw new PaymentSettlementError(
      'settlement_confirmation_required',
    )
  }
  if (
    ticket.network !== 'eip155:84532' ||
    paymentPayload.accepted.network !== 'eip155:84532'
  ) {
    throw new PaymentSettlementError('settlement_network_not_allowed')
  }
  if (
    ticket.amountUsdc > maxBudgetUsdc ||
    ticket.amountUsdc > 0.005
  ) {
    throw new PaymentSettlementError('settlement_budget_exceeded')
  }

  const url = new URL(facilitatorUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'x402.org') {
    throw new PaymentSettlementError(
      'settlement_facilitator_not_allowed',
    )
  }

  assertPaymentPayloadMatchesTicket(ticket, paymentPayload)
  return url.toString().replace(/\/+$/, '')
}

export async function settleVerifiedPaymentCredential({
  ticket,
  paymentPayload,
  facilitatorUrl,
  maxBudgetUsdc,
  settlementConfirmation,
  facilitatorClient,
}: {
  ticket: SettlementPaymentTicket
  paymentPayload: PaymentPayload
  facilitatorUrl: string
  maxBudgetUsdc: number
  settlementConfirmation: string
  facilitatorClient?: Pick<HTTPFacilitatorClient, 'settle'>
}): Promise<PaymentSettlementResult> {
  const normalizedFacilitatorUrl = assertSettlementRequest({
    ticket,
    paymentPayload,
    facilitatorUrl,
    maxBudgetUsdc,
    settlementConfirmation,
  })
  const requirements: PaymentRequirements = paymentPayload.accepted
  const facilitator =
    facilitatorClient ??
    new HTTPFacilitatorClient({
      url: normalizedFacilitatorUrl,
    })
  let response: SettleResponse
  try {
    response = await settleWithTimeout(
      facilitator,
      paymentPayload,
      requirements,
    )
  } catch (error) {
    if (!(error instanceof SettleError)) {
      throw error
    }
    response = {
      success: false,
      errorReason: error.errorReason,
      errorMessage: error.errorMessage,
      payer: error.payer,
      transaction: error.transaction,
      network: error.network,
    }
  }

  return {
    facilitatorUrl: normalizedFacilitatorUrl,
    resultHash: createHash('sha256')
      .update(JSON.stringify(response))
      .digest('hex'),
    response,
  }
}
