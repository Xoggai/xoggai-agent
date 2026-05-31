import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from './env.js'
import { corsMiddleware } from './middleware/cors.js'
import { loggerMiddleware } from './middleware/logger.js'
import { rateLimitMiddleware } from './middleware/rateLimit.js'
import { endpointsRoute } from './routes/endpoints.js'
import { feedRoute } from './routes/feed.js'
import { healthRoute } from './routes/health.js'
import { infoRoute } from './routes/info.js'
import { intentRoute } from './routes/intent.js'
import { searchRoute } from './routes/search.js'
import { statsRoute } from './routes/stats.js'
import { ratingWorker } from './services/ratingEngine.js'
import { startStatsCollector } from './services/statsCollector.js'

const app = new Hono()

app.use('*', loggerMiddleware)
app.use('*', corsMiddleware)
app.use('/intent', rateLimitMiddleware)
app.use('/search', rateLimitMiddleware)

app.get('/', (c) =>
  c.json({
    name: 'XoggAI Backend',
    status: 'live',
    mode: 'public-preview',
    execution: 'dry-run by default',
    website: 'https://xoggai-agent.com',
    docs: 'https://xoggai-agent.com/docs',
    repository: 'https://github.com/Xoggai/xoggai-agent',
    endpoints: {
      info: '/api/info',
      health: '/health',
      intent: '/intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true',
      search: '/search?q=crypto%20price&limit=5&dry=true',
      stats: '/api/stats',
      feed: '/api/feed',
      endpoints: '/api/endpoints',
    },
  }),
)

app.route('/intent', intentRoute)
app.route('/search', searchRoute)
app.route('/api/info', infoRoute)
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
