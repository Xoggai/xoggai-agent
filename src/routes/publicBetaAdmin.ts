import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env.js'
import {
  createPublicBetaApiKey,
  createPublicBetaUser,
  listPublicBetaApiKeys,
  listPublicBetaUsers,
  revokePublicBetaApiKey,
  secureSecretEqual,
  updatePublicBetaUser,
} from '../services/publicBetaAuth.js'
import {
  decidePublicBetaExecutionRequest,
  listAdminBetaExecutionRequests,
} from '../services/publicBetaRequests.js'

const userSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(2).max(100),
  keyLabel: z.string().trim().min(2).max(100).default('Primary'),
  maxBudgetUsdc: z.number().positive().max(0.005).default(0.005),
  dailyRequestLimit: z.number().int().min(1).max(1000).default(25),
  dailyBudgetUsdc: z.number().positive().max(10).default(0.05),
})
const listSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  reason: z.string().trim().max(500).optional(),
  approvedBy: z.string().trim().min(2).max(100),
})
const keySchema = z.object({
  label: z.string().trim().min(2).max(100).default('Rotated key'),
})
const userUpdateSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    maxBudgetUsdc: z.number().positive().max(0.005).optional(),
    dailyRequestLimit: z.number().int().min(1).max(1000).optional(),
    dailyBudgetUsdc: z.number().positive().max(10).optional(),
    actorId: z.string().trim().min(2).max(100),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.maxBudgetUsdc !== undefined ||
      value.dailyRequestLimit !== undefined ||
      value.dailyBudgetUsdc !== undefined,
  )

function adminValid(candidate: string | undefined) {
  return Boolean(
    candidate &&
      env.PUBLIC_BETA_ADMIN_KEY &&
      secureSecretEqual(candidate, env.PUBLIC_BETA_ADMIN_KEY),
  )
}

export const publicBetaAdminRoute = new Hono()
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    if (!env.PUBLIC_BETA_ADMIN_KEY) {
      return c.json(
        { success: false, error: 'public_beta_admin_not_configured' },
        503,
      )
    }
    if (!adminValid(c.req.header('x-admin-key'))) {
      return c.json({ success: false, error: 'invalid_admin_access' }, 401)
    }
    await next()
  })
  .post('/users', async (c) => {
    const parsed = userSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'invalid_request',
          detail: parsed.error.flatten(),
        },
        400,
      )
    }
    try {
      const created = await createPublicBetaUser(parsed.data)
      return c.json(
        {
          success: true,
          user: created.user,
          apiKey: created.apiKey,
          key: created.key,
          warning: 'This API key is shown once. Store it securely.',
        },
        201,
      )
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error &&
            error.message.includes('beta_users_email_unique')
              ? 'beta_user_already_exists'
              : 'beta_user_creation_failed',
        },
        409,
      )
    }
  })
  .get('/users', async (c) => {
    const users = await listPublicBetaUsers()
    return c.json({ success: true, users })
  })
  .get('/users/:id/keys', async (c) => {
    const keys = await listPublicBetaApiKeys(c.req.param('id'))
    return c.json({ success: true, keys })
  })
  .patch('/users/:id', async (c) => {
    const parsed = userUpdateSchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    try {
      const user = await updatePublicBetaUser({
        userId: c.req.param('id'),
        ...parsed.data,
      })
      return c.json({ success: true, user })
    } catch {
      return c.json({ success: false, error: 'beta_user_not_found' }, 404)
    }
  })
  .post('/users/:id/keys', async (c) => {
    const parsed = keySchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    try {
      const result = await createPublicBetaApiKey({
        userId: c.req.param('id'),
        label: parsed.data.label,
      })
      return c.json(
        {
          success: true,
          ...result,
          warning: 'This API key is shown once. Store it securely.',
        },
        201,
      )
    } catch {
      return c.json({ success: false, error: 'beta_api_key_not_created' }, 409)
    }
  })
  .post('/keys/:id/revoke', async (c) => {
    try {
      const key = await revokePublicBetaApiKey({
        keyId: c.req.param('id'),
        actorId: 'public-beta-admin-api',
      })
      return c.json({ success: true, key })
    } catch {
      return c.json({ success: false, error: 'beta_api_key_not_active' }, 409)
    }
  })
  .get('/requests', async (c) => {
    const parsed = listSchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    const requests = await listAdminBetaExecutionRequests(parsed.data)
    return c.json({ success: true, requests })
  })
  .patch('/requests/:id', async (c) => {
    const parsed = decisionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ success: false, error: 'invalid_request' }, 400)
    }
    try {
      const request = await decidePublicBetaExecutionRequest({
        id: c.req.param('id'),
        ...parsed.data,
      })
      return c.json({ success: true, request })
    } catch {
      return c.json(
        { success: false, error: 'beta_execution_request_not_pending' },
        409,
      )
    }
  })
