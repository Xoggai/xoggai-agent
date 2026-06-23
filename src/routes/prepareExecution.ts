import { auditedX402Candidate } from '../config/auditedX402.js'
import { env } from '../env.js'
import {
  createPreparedPaymentTicket,
  getBetaExecutionUsage,
} from '../services/paymentPrepareTickets.js'
import { createPrepareExecutionRoute } from './prepareExecutionRoute.js'

export const prepareExecutionRoute = createPrepareExecutionRoute({
  enabled: env.X402_PREPARE_ENABLED,
  betaExecutionKey: env.BETA_EXECUTION_KEY,
  betaAccessKeys: env.BETA_ACCESS_KEYS,
  maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
  dailyRequestLimit: env.BETA_DAILY_REQUEST_LIMIT,
  dailyBudgetUsdc: env.BETA_DAILY_BUDGET_USDC,
  policy: auditedX402Candidate,
  async fetchChallenge() {
    const response = await fetch(auditedX402Candidate.resourceUrl, {
      method: auditedX402Candidate.method,
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })

    return {
      status: response.status,
      paymentRequired: response.headers.get('payment-required') ?? undefined,
    }
  },
  loadUsage: getBetaExecutionUsage,
  savePreparedPayment: createPreparedPaymentTicket,
})
