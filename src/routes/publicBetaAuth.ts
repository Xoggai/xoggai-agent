import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env.js'
import {
  authenticatePublicBetaApiKey,
  bearerToken,
  createPublicBetaSession,
  revokePublicBetaSession,
} from '../services/publicBetaAuth.js'

const loginSchema = z.object({
  apiKey: z.string().min(32).max(200),
})

export const publicBetaAuthRoute = new Hono()
  .post('/login', async (c) => {
    c.header('Cache-Control', 'no-store')
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    const user = await authenticatePublicBetaApiKey(parsed.data.apiKey)
    if (!user) {
      return c.json({ success: false, error: 'invalid_beta_credentials' }, 401)
    }
    const session = await createPublicBetaSession({
      userId: user.id,
      ttlSeconds: env.PUBLIC_BETA_SESSION_TTL_SECONDS,
    })
    return c.json({ success: true, user, session })
  })
  .post('/logout', async (c) => {
    const token = bearerToken(c.req.header('authorization'))
    if (token) await revokePublicBetaSession(token)
    return c.json({ success: true })
  })
