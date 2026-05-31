import { Hono } from 'hono'
import { env, hasLiveAnthropicKey, hasLiveX402Wallet } from '../env.js'

export const infoRoute = new Hono().get('/', (c) => {
  return c.json({
    name: 'XoggAI Backend',
    version: '1.0.0',
    status: 'live',
    mode: 'public-preview',
    environment: env.NODE_ENV,
    network: env.X402_NETWORK,
    liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
    defaultExecution: 'dry-run',
    configured: {
      anthropic: hasLiveAnthropicKey(),
      x402Wallet: hasLiveX402Wallet(),
    },
    urls: {
      website: 'https://xoggai-agent.com',
      docs: 'https://xoggai-agent.com/docs',
      repository: 'https://github.com/Xoggai/xoggai-agent',
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
    },
    commit:
      process.env.RENDER_GIT_COMMIT ||
      process.env.COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      null,
    ts: Date.now(),
  })
})
