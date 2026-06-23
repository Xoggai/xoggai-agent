import { Hono } from 'hono'
import {
  betaAccessProfileCount,
  env,
  hasLiveX402Wallet,
} from '../env.js'
import { countEnabledExecutionEndpoints } from '../services/executionAllowlist.js'

function safetyMode() {
  if (env.ALLOW_LIVE_EXECUTION) {
    return 'live-execution'
  }
  if (env.X402_SETTLEMENT_ENABLED) {
    return 'testnet-settlement'
  }
  if (env.X402_UPSTREAM_EXECUTION_ENABLED) {
    return 'testnet-upstream-execution'
  }
  if (env.X402_VERIFY_ENABLED) {
    return 'verification-rehearsal'
  }
  if (env.X402_SIGNING_ENABLED) {
    return 'signing-rehearsal'
  }
  if (env.X402_PREPARE_ENABLED) {
    return 'ticket-rehearsal'
  }
  if (env.EXECUTION_SIMULATION_ENABLED) {
    return 'simulation'
  }
  return 'dry-run-preview'
}

export function createExecutionStatusRoute(
  getAllowlistedEndpointCount = countEnabledExecutionEndpoints,
) {
  return new Hono().get('/', async (c) => {
    const allowlistedEndpointCount = await getAllowlistedEndpointCount()

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
      ticketSigningEnabled: env.X402_SIGNING_ENABLED,
      ticketVerificationEnabled: env.X402_VERIFY_ENABLED,
      ticketSettlementEnabled: env.X402_SETTLEMENT_ENABLED,
      upstreamExecutionEnabled: env.X402_UPSTREAM_EXECUTION_ENABLED,
      liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
      paymentSigningEnabled: env.X402_SIGNING_ENABLED,
      paymentVerificationEnabled: env.X402_VERIFY_ENABLED,
      paymentSendingEnabled:
        env.X402_SETTLEMENT_ENABLED || env.X402_UPSTREAM_EXECUTION_ENABLED,
      walletConfigured: hasLiveX402Wallet(),
      betaAccessConfigured: betaAccessProfileCount() > 0,
      betaAccessProfileCount: betaAccessProfileCount(),
      betaDailyRequestLimit: env.BETA_DAILY_REQUEST_LIMIT,
      betaDailyBudgetUsdc: env.BETA_DAILY_BUDGET_USDC,
      publicBetaAdminConfigured: Boolean(env.PUBLIC_BETA_ADMIN_KEY),
      publicBetaEnabled: env.PUBLIC_BETA_ENABLED,
      publicBetaSessionTtlSeconds: env.PUBLIC_BETA_SESSION_TTL_SECONDS,
      publicBetaRequestTtlSeconds: env.PUBLIC_BETA_REQUEST_TTL_SECONDS,
      operationsKillSwitchActive: env.OPERATIONS_KILL_SWITCH,
      version: env.SERVICE_VERSION,
      environment: env.DEPLOYMENT_ENVIRONMENT,
      allowlistedEndpointCount,
      maxExecutionBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      guardrails: {
        liveExecutionBlockedAtStartup: true,
        paymentRequiresApprovedTicket: true,
        approvedTicketMustBeConsumed: true,
        signingRestrictedToConsumedTickets: true,
        signingRestrictedToBaseSepolia: true,
        signedCredentialsAreNeverBroadcastByBackend: true,
        verificationNeverCallsSettlement: true,
        facilitatorRestrictedToX402Org: true,
        settlementRequiresVerifiedTicket: true,
        settlementRequiresExplicitConfirmation: true,
        settlementHasNoAutomaticRetry: true,
        upstreamExecutionRequiresVerifiedTicket: true,
        upstreamExecutionRequiresExplicitConfirmation: true,
        upstreamExecutionHasNoAutomaticRetry: true,
        browserNeverReceivesBetaKey: true,
        dryRunsNeverSendPayment: true,
        operationsKillSwitchAvailable: true,
        publicBetaCanBeDisabledIndependently: true,
        betaRequestsRequireIdempotencyKeys: true,
        betaRequestsExpireBeforeExecution: true,
        testnetExecutionRequiresManagedAllowlist: true,
      },
      endpoints: {
        prepare: '/execute/prepare',
        approve: '/execute/approve',
        consume: '/execute/consume',
        sign: '/execute/sign',
        verify: '/execute/verify',
        settle: '/execute/settle',
        upstream: '/execute/upstream',
      },
      ts: Date.now(),
    })
  })
}

export const executionStatusRoute = createExecutionStatusRoute()
