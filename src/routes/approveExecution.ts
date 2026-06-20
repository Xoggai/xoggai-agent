import { env } from '../env.js'
import { approvePreparedPaymentTicket } from '../services/paymentPrepareTickets.js'
import { createApproveExecutionRoute } from './approveExecutionRoute.js'

export const approveExecutionRoute = createApproveExecutionRoute({
  enabled: env.X402_PREPARE_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  approveTicket: approvePreparedPaymentTicket,
})
