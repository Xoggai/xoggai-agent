import { env } from '../env.js'
import {
  authenticateBetaAccess,
  type BetaAccessContext,
} from './betaAccess.js'

export function configuredBetaAccess(
  candidate: string | undefined,
): BetaAccessContext | undefined {
  return authenticateBetaAccess({
    candidate,
    betaAccessKeys: env.BETA_ACCESS_KEYS,
    betaExecutionKey: env.BETA_EXECUTION_KEY,
    maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
    dailyRequestLimit: env.BETA_DAILY_REQUEST_LIMIT,
    dailyBudgetUsdc: env.BETA_DAILY_BUDGET_USDC,
  })
}

export function configuredBetaAccessValid(candidate: string | undefined) {
  return Boolean(configuredBetaAccess(candidate))
}
