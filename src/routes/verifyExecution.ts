import { env } from '../env.js'
import {
  configuredBetaAccess,
  configuredBetaAccessValid,
} from '../services/configuredBetaAccess.js'
import {
  loadSignedPaymentTicket,
  recordPaymentVerification,
} from '../services/paymentPrepareTickets.js'
import { verifySignedPaymentCredential } from '../services/x402PaymentVerification.js'
import { createVerifyExecutionRoute } from './verifyExecutionRoute.js'

export const verifyExecutionRoute = createVerifyExecutionRoute({
  enabled: env.X402_VERIFY_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  validateBetaAccess: configuredBetaAccessValid,
  resolveBetaAccess: configuredBetaAccess,
  loadTicket: loadSignedPaymentTicket,
  verifyPayment: (ticket, paymentPayload) =>
    verifySignedPaymentCredential({
      ticket,
      paymentPayload,
      facilitatorUrl: env.X402_FACILITATOR_URL,
    }),
  recordVerification: recordPaymentVerification,
})
