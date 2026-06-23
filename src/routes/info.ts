import { Hono } from 'hono'
import { env, hasLiveAnthropicKey, hasLiveX402Wallet } from '../env.js'

export const infoRoute = new Hono().get('/', (c) => {
  return c.json({
    name: 'XoggAI Backend',
    version: env.SERVICE_VERSION,
    description: 'Dry-run-first intent router for AI agents and x402 API endpoints.',
    status: 'live',
    mode: 'public-preview',
    environment: env.DEPLOYMENT_ENVIRONMENT,
    network: env.X402_NETWORK,
    liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
    executionSimulationEnabled: env.EXECUTION_SIMULATION_ENABLED,
    signingEnabled: env.X402_SIGNING_ENABLED,
    verificationEnabled: env.X402_VERIFY_ENABLED,
    settlementEnabled: env.X402_SETTLEMENT_ENABLED,
    upstreamExecutionEnabled: env.X402_UPSTREAM_EXECUTION_ENABLED,
    operationsKillSwitchActive: env.OPERATIONS_KILL_SWITCH,
    publicBetaEnabled: env.PUBLIC_BETA_ENABLED,
    defaultExecution: 'dry-run',
    safety: {
      dryRunDefault: true,
      paymentSentByDefault: false,
      callerPays: true,
      liveExecutionRequiresWalletAndBudget: true,
    },
    configured: {
      anthropic: hasLiveAnthropicKey(),
      x402Wallet: hasLiveX402Wallet(),
    },
    urls: {
      website: 'https://xoggai-agent.com',
      docs: 'https://xoggai-agent.com/docs',
      repository: 'https://github.com/Xoggai/xoggai-agent',
    },
    agentFiles: {
      skill: 'https://xoggai-agent.com/skill.md',
      llms: 'https://xoggai-agent.com/llms.txt',
      openapi: 'https://xoggai-agent.com/openapi.json',
    },
    sampleRequests: {
      health: 'GET /health',
      readiness: 'GET /ready',
      executionStatus: 'GET /api/execution-status',
      betaExecutions: 'GET /api/beta/executions (requires x-beta-key)',
      betaConsole: 'https://xoggai-agent.com/beta/',
      routeIntent:
        'GET /intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true',
      searchEndpoints: 'GET /search?q=crypto%20price&limit=5&dry=true',
      simulateExecution: 'POST /execute (requires x-beta-key)',
      preparePayment: 'POST /execute/prepare (requires x-beta-key)',
      approvePayment: 'POST /execute/approve (requires x-beta-key)',
      consumePayment: 'POST /execute/consume (requires x-beta-key)',
      signPayment: 'POST /execute/sign (requires x-beta-key; testnet only)',
      verifyPayment:
        'POST /execute/verify (requires x-beta-key; verify-only)',
      settlePayment:
        'POST /execute/settle (requires x-beta-key; funded testnet only)',
      executeUpstream:
        'POST /execute/upstream (requires x-beta-key; paid testnet resource only)',
    },
    endpoints: {
      root: '/',
      info: '/api/info',
      health: '/health',
      readiness: '/ready',
      executionStatus: '/api/execution-status',
      betaExecutions: '/api/beta/executions',
      betaLogin: '/api/beta/auth/login',
      betaDashboard: '/api/beta/dashboard/me',
      intent: '/intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true',
      search: '/search?q=crypto%20price&limit=5&dry=true',
      stats: '/api/stats',
      feed: '/api/feed',
      endpoints: '/api/endpoints',
      execute: '/execute',
      preparePayment: '/execute/prepare',
      approvePayment: '/execute/approve',
      consumePayment: '/execute/consume',
      signPayment: '/execute/sign',
      verifyPayment: '/execute/verify',
      settlePayment: '/execute/settle',
      executeUpstream: '/execute/upstream',
    },
    note: 'Public preview keeps live x402 execution gated. Use dry=true for safe routing previews.',
    commit:
      process.env.RENDER_GIT_COMMIT ||
      process.env.COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      null,
    ts: Date.now(),
  })
})
