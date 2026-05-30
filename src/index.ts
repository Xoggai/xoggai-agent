import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from './env.js'
import { corsMiddleware } from './middleware/cors.js'
import { loggerMiddleware } from './middleware/logger.js'
import { rateLimitMiddleware } from './middleware/rateLimit.js'
import { endpointsRoute } from './routes/endpoints.js'
import { feedRoute } from './routes/feed.js'
import { healthRoute } from './routes/health.js'
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

app.route('/intent', intentRoute)
app.route('/search', searchRoute)
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
