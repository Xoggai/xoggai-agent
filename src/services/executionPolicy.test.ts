import assert from 'node:assert/strict'
import { evaluateExecutionPolicy } from './executionPolicy.js'

const input = {
  endpointId: 'endpoint-1',
  endpointPriceUsdc: 0.01,
  budgetUsdc: 0.05,
}

const config = {
  liveExecutionEnabled: true,
  betaAccessConfigured: true,
  betaAccessValid: true,
  maxBudgetUsdc: 0.05,
  endpointAllowlist: new Set(['endpoint-1']),
}

assert.deepEqual(evaluateExecutionPolicy(input, config), {
  eligibleForLive: true,
  blockedBy: [],
})

const disabled = evaluateExecutionPolicy(input, {
  ...config,
  liveExecutionEnabled: false,
})
assert.ok(disabled.blockedBy.includes('live_execution_disabled'))

const invalidKey = evaluateExecutionPolicy(input, {
  ...config,
  betaAccessValid: false,
})
assert.ok(invalidKey.blockedBy.includes('invalid_beta_access'))

const unknownEndpoint = evaluateExecutionPolicy(input, {
  ...config,
  endpointAllowlist: new Set(),
})
assert.ok(unknownEndpoint.blockedBy.includes('endpoint_not_allowlisted'))

const excessiveBudget = evaluateExecutionPolicy(
  { ...input, budgetUsdc: 0.1 },
  config,
)
assert.ok(excessiveBudget.blockedBy.includes('budget_above_limit'))

const underfunded = evaluateExecutionPolicy(
  { ...input, endpointPriceUsdc: 0.06 },
  config,
)
assert.ok(underfunded.blockedBy.includes('endpoint_price_above_budget'))

console.log('execution policy tests passed')
