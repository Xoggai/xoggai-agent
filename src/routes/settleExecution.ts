import { env } from '../env.js'
import {
  configuredBetaAccess,
  configuredBetaAccessValid,
} from '../services/configuredBetaAccess.js'
import {
  claimVerifiedPaymentTicketForSettlement,
  loadVerifiedPaymentTicket,
  recordPaymentSettlement,
} from '../services/paymentPrepareTickets.js'
import {
  assertSettlementRequest,
  settleVerifiedPaymentCredential,
} from '../services/x402PaymentSettlement.js'
import { createSettleExecutionRoute } from './settleExecutionRoute.js'

export const settleExecutionRoute = createSettleExecutionRoute({
  enabled: env.X402_SETTLEMENT_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  validateBetaAccess: configuredBetaAccessValid,
  resolveBetaAccess: configuredBetaAccess,
  loadTicket: loadVerifiedPaymentTicket,
  validateSettlement: (ticket, paymentPayload, settlementConfirmation) => {
    assertSettlementRequest({
      ticket,
      paymentPayload,
      facilitatorUrl: env.X402_FACILITATOR_URL,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      settlementConfirmation,
    })
  },
  claimTicket: claimVerifiedPaymentTicketForSettlement,
  settlePayment: (ticket, paymentPayload, settlementConfirmation) =>
    settleVerifiedPaymentCredential({
      ticket,
      paymentPayload,
      facilitatorUrl: env.X402_FACILITATOR_URL,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      settlementConfirmation,
    }),
  recordSettlement: recordPaymentSettlement,
})
