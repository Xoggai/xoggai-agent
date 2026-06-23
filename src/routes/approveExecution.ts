import { env } from '../env.js'
import {
  configuredBetaAccess,
  configuredBetaAccessValid,
} from '../services/configuredBetaAccess.js'
import { approvePreparedPaymentTicket } from '../services/paymentPrepareTickets.js'
import { createApproveExecutionRoute } from './approveExecutionRoute.js'

export const approveExecutionRoute = createApproveExecutionRoute({
  enabled: env.X402_PREPARE_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  validateBetaAccess: configuredBetaAccessValid,
  resolveBetaAccess: configuredBetaAccess,
  approveTicket: approvePreparedPaymentTicket,
})
