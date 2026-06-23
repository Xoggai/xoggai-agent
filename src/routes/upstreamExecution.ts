import { auditedX402Candidate } from '../config/auditedX402.js'
import { env } from '../env.js'
import {
  configuredBetaAccess,
  configuredBetaAccessValid,
} from '../services/configuredBetaAccess.js'
import {
  claimVerifiedPaymentTicketForUpstream,
  loadVerifiedPaymentTicketForUpstream,
  recordUpstreamExecution,
} from '../services/paymentPrepareTickets.js'
import {
  assertUpstreamExecutionRequest,
  executeVerifiedX402Resource,
} from '../services/x402UpstreamExecution.js'
import { createUpstreamExecutionRoute } from './upstreamExecutionRoute.js'

export const upstreamExecutionRoute = createUpstreamExecutionRoute({
  enabled: env.X402_UPSTREAM_EXECUTION_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  validateBetaAccess: configuredBetaAccessValid,
  resolveBetaAccess: configuredBetaAccess,
  loadTicket: loadVerifiedPaymentTicketForUpstream,
  validateExecution: (ticket, paymentPayload, executionConfirmation) => {
    assertUpstreamExecutionRequest({
      ticket,
      paymentPayload,
      policy: auditedX402Candidate,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      executionConfirmation,
    })
  },
  claimTicket: claimVerifiedPaymentTicketForUpstream,
  executeUpstream: (ticket, paymentPayload, executionConfirmation) =>
    executeVerifiedX402Resource({
      ticket,
      paymentPayload,
      policy: auditedX402Candidate,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      executionConfirmation,
    }),
  recordExecution: recordUpstreamExecution,
})
