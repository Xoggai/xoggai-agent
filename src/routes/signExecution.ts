import { env } from '../env.js'
import {
  configuredBetaAccess,
  configuredBetaAccessValid,
} from '../services/configuredBetaAccess.js'
import {
  loadConsumedPaymentTicket,
  markPaymentTicketSigned,
} from '../services/paymentPrepareTickets.js'
import { createSignedPaymentCredential } from '../services/x402PaymentSigning.js'
import { createSignExecutionRoute } from './signExecutionRoute.js'

export const signExecutionRoute = createSignExecutionRoute({
  enabled: env.X402_SIGNING_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  validateBetaAccess: configuredBetaAccessValid,
  resolveBetaAccess: configuredBetaAccess,
  loadTicket: loadConsumedPaymentTicket,
  signPayment: (ticket) =>
    createSignedPaymentCredential({
      ticket,
      privateKey: env.X402_WALLET_PRIVATE_KEY ?? '',
      expectedAddress: env.X402_WALLET_ADDRESS ?? '',
    }),
  markSigned: markPaymentTicketSigned,
})
