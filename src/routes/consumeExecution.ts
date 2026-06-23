import { env } from '../env.js'
import {
  configuredBetaAccess,
  configuredBetaAccessValid,
} from '../services/configuredBetaAccess.js'
import { consumeApprovedPaymentTicket } from '../services/paymentPrepareTickets.js'
import { createConsumeExecutionRoute } from './consumeExecutionRoute.js'

export const consumeExecutionRoute = createConsumeExecutionRoute({
  enabled: env.X402_PREPARE_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  validateBetaAccess: configuredBetaAccessValid,
  resolveBetaAccess: configuredBetaAccess,
  consumeTicket: consumeApprovedPaymentTicket,
})
