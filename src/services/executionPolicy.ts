export type ExecutionPolicyInput = {
  endpointId: string
  endpointPriceUsdc: number
  budgetUsdc: number
}

export type ExecutionPolicyConfig = {
  liveExecutionEnabled: boolean
  betaAccessConfigured: boolean
  betaAccessValid: boolean
  maxBudgetUsdc: number
  endpointAllowlist: ReadonlySet<string>
}

export type ExecutionBlockReason =
  | 'live_execution_disabled'
  | 'beta_access_not_configured'
  | 'invalid_beta_access'
  | 'endpoint_not_allowlisted'
  | 'budget_above_limit'
  | 'endpoint_price_above_budget'

export function evaluateExecutionPolicy(
  input: ExecutionPolicyInput,
  config: ExecutionPolicyConfig,
) {
  const blockedBy: ExecutionBlockReason[] = []

  if (!config.liveExecutionEnabled) blockedBy.push('live_execution_disabled')
  if (!config.betaAccessConfigured) blockedBy.push('beta_access_not_configured')
  if (config.betaAccessConfigured && !config.betaAccessValid) {
    blockedBy.push('invalid_beta_access')
  }
  if (!config.endpointAllowlist.has(input.endpointId)) {
    blockedBy.push('endpoint_not_allowlisted')
  }
  if (input.budgetUsdc > config.maxBudgetUsdc) {
    blockedBy.push('budget_above_limit')
  }
  if (input.endpointPriceUsdc > input.budgetUsdc) {
    blockedBy.push('endpoint_price_above_budget')
  }

  return {
    eligibleForLive: blockedBy.length === 0,
    blockedBy,
  }
}
