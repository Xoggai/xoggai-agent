import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env, hasLiveAnthropicKey, hasLiveX402Wallet } from './env.js'
import { corsMiddleware } from './middleware/cors.js'
import { loggerMiddleware } from './middleware/logger.js'
import { rateLimitMiddleware } from './middleware/rateLimit.js'
import { approveExecutionRoute } from './routes/approveExecution.js'
import { consumeExecutionRoute } from './routes/consumeExecution.js'
import { endpointsRoute } from './routes/endpoints.js'
import { executeRoute } from './routes/execute.js'
import { executionStatusRoute } from './routes/executionStatus.js'
import { feedRoute } from './routes/feed.js'
import { healthRoute } from './routes/health.js'
import { infoRoute } from './routes/info.js'
import { intentRoute } from './routes/intent.js'
import { prepareExecutionRoute } from './routes/prepareExecution.js'
import { searchRoute } from './routes/search.js'
import { settleExecutionRoute } from './routes/settleExecution.js'
import { signExecutionRoute } from './routes/signExecution.js'
import { upstreamExecutionRoute } from './routes/upstreamExecution.js'
import { verifyExecutionRoute } from './routes/verifyExecution.js'
import { statsRoute } from './routes/stats.js'
import { ratingWorker } from './services/ratingEngine.js'
import { startStatsCollector } from './services/statsCollector.js'

const app = new Hono()

app.use('*', loggerMiddleware)
app.use('*', corsMiddleware)
app.use('/intent', rateLimitMiddleware)
app.use('/search', rateLimitMiddleware)
app.use('/execute', rateLimitMiddleware)
app.use('/execute/*', rateLimitMiddleware)

app.get('/', (c) =>
  c.json({
    name: 'XoggAI Backend',
    description: 'Dry-run-first intent router for AI agents and x402 API endpoints.',
    status: 'live',
    mode: 'public-preview',
    defaultExecution: 'dry-run',
    liveExecutionEnabled: env.ALLOW_LIVE_EXECUTION,
    executionSimulationEnabled: env.EXECUTION_SIMULATION_ENABLED,
    network: env.X402_NETWORK,
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
      executionStatus: 'GET /api/execution-status',
      routeIntent:
        'GET /intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true',
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
      info: '/api/info',
      health: '/health',
      executionStatus: '/api/execution-status',
      intent: '/intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true',
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
  }),
)

app.route('/intent', intentRoute)
app.route('/search', searchRoute)
app.route('/execute', executeRoute)
app.route('/execute/prepare', prepareExecutionRoute)
app.route('/execute/approve', approveExecutionRoute)
app.route('/execute/consume', consumeExecutionRoute)
app.route('/execute/sign', signExecutionRoute)
app.route('/execute/verify', verifyExecutionRoute)
app.route('/execute/settle', settleExecutionRoute)
app.route('/execute/upstream', upstreamExecutionRoute)
app.route('/api/info', infoRoute)
app.route('/api/execution-status', executionStatusRoute)
app.route('/api/stats', statsRoute)
app.route('/api/feed', feedRoute)
app.route('/api/endpoints', endpointsRoute)
app.route('/health', healthRoute)

startStatsCollector()
void ratingWorker.waitUntilReady().catch((error) => {
  console.error('ratingWorker failed to initialize', error)
})

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`XoggAI backend listening on http://localhost:${info.port}`)
  },
)

export { app }
export default {
  port: env.PORT,
  fetch: app.fetch,
}
