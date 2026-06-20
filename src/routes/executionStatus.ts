import { Hono } from 'hono'
import { env, executionEndpointAllowlist, hasLiveX402Wallet } from '../env.js'

function safetyMode() {
  if (env.ALLOW_LIVE_EXECUTION) {
    return 'live-execution'
  }
  if (env.X402_PREPARE_ENABLED) {
    return 'ticket-rehearsal'
  }
  if (env.EXECUTION_SIMULATION_ENABLED) {
    return 'simulation'
  }
  return 'dry-run-preview'
}

export const executionStatusRoute = new Hono().get('/', (c) => {
  const allowlist = executionEndpointAllowlist()

  return c.json({
    status: 'ok',
    safetyMode: safetyMode(),
    defaultExecution: 'dry-run',
    network: env.X402_NETWORK,
    dryRunEnabled: true,
    executionSimulationEnabled: env.EXECUTION_SIMULATION_ENABLED,
    prepareEnabled: env.X402_PREPARE_ENABLED,
    ticketApprovalEnabled: env.X402_PREPARE_ENABLED,
    ticketConsumeEnabled: env.X402_PREPARE_ENABLED,
    liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
    paymentSigningEnabled: false,
    paymentSendingEnabled: false,
    walletConfigured: hasLiveX402Wallet(),
    betaAccessConfigured: Boolean(env.BETA_EXECUTION_KEY),
    allowlistedEndpointCount: allowlist.size,
    maxExecutionBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
    guardrails: {
      liveExecutionBlockedAtStartup: true,
      paymentRequiresApprovedTicket: true,
      approvedTicketMustBeConsumed: true,
      browserNeverReceivesBetaKey: true,
      dryRunsNeverSendPayment: true,
    },
    endpoints: {
      prepare: '/execute/prepare',
      approve: '/execute/approve',
      consume: '/execute/consume',
    },
    ts: Date.now(),
  })
})
