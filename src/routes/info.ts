import { Hono } from 'hono'
import { env, hasLiveAnthropicKey, hasLiveX402Wallet } from '../env.js'

export const infoRoute = new Hono().get('/', (c) => {
  return c.json({
    name: 'XoggAI Backend',
    version: '1.0.0',
    description: 'Dry-run-first intent router for AI agents and x402 API endpoints.',
    status: 'live',
    mode: 'public-preview',
    environment: env.NODE_ENV,
    network: env.X402_NETWORK,
    liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
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
      routeIntent:
        'GET /intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true',
      searchEndpoints: 'GET /search?q=crypto%20price&limit=5&dry=true',
      simulateExecution: 'POST /execute (requires x-beta-key)',
    },
    endpoints: {
      root: '/',
      info: '/api/info',
      health: '/health',
      intent: '/intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true',
      search: '/search?q=crypto%20price&limit=5&dry=true',
      stats: '/api/stats',
      feed: '/api/feed',
      endpoints: '/api/endpoints',
      execute: '/execute',
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
