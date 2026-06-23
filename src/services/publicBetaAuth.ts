import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  betaApiKeys,
  betaAuditEvents,
  betaSessions,
  betaUsers,
} from '../db/schema.js'

export type PublicBetaUser = {
  id: string
  email: string
  displayName: string
  status: string
  maxBudgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
}

export function hashPublicBetaSecret(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function generatePublicBetaApiKey() {
  return `xg_beta_${randomBytes(32).toString('base64url')}`
}

export function generatePublicBetaSessionToken() {
  return `xg_session_${randomBytes(32).toString('base64url')}`
}

export function secureSecretEqual(candidate: string, expected: string) {
  const actualBuffer = Buffer.from(candidate)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export async function createPublicBetaUser(input: {
  email: string
  displayName: string
  keyLabel: string
  maxBudgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
}) {
  const apiKey = generatePublicBetaApiKey()
  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(betaUsers)
      .values({
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        maxBudgetUsdc: input.maxBudgetUsdc,
        dailyRequestLimit: input.dailyRequestLimit,
        dailyBudgetUsdc: input.dailyBudgetUsdc,
      })
      .returning()
    if (!user) throw new Error('beta_user_not_created')

    const [key] = await tx
      .insert(betaApiKeys)
      .values({
        userId: user.id,
        label: input.keyLabel,
        keyPrefix: apiKey.slice(0, 16),
        keyHash: hashPublicBetaSecret(apiKey),
      })
      .returning({
        id: betaApiKeys.id,
        label: betaApiKeys.label,
        keyPrefix: betaApiKeys.keyPrefix,
        createdAt: betaApiKeys.createdAt,
      })
    await tx.insert(betaAuditEvents).values({
      userId: user.id,
      actorType: 'ADMIN',
      action: 'BETA_USER_CREATED',
      targetType: 'USER',
      targetId: user.id,
    })
    return { user, key }
  })

  return { ...result, apiKey }
}

export async function createPublicBetaApiKey(input: {
  userId: string
  label: string
}) {
  const apiKey = generatePublicBetaApiKey()
  const [key] = await db
    .insert(betaApiKeys)
    .values({
      userId: input.userId,
      label: input.label,
      keyPrefix: apiKey.slice(0, 16),
      keyHash: hashPublicBetaSecret(apiKey),
    })
    .returning({
      id: betaApiKeys.id,
      label: betaApiKeys.label,
      keyPrefix: betaApiKeys.keyPrefix,
      createdAt: betaApiKeys.createdAt,
    })
  if (!key) throw new Error('beta_api_key_not_created')
  await db.insert(betaAuditEvents).values({
    userId: input.userId,
    actorType: 'ADMIN',
    action: 'API_KEY_CREATED',
    targetType: 'API_KEY',
    targetId: key.id,
  })
  return { key, apiKey }
}

export async function revokePublicBetaApiKey(input: {
  keyId: string
  actorId: string
}) {
  const now = new Date()
  const [key] = await db
    .update(betaApiKeys)
    .set({ status: 'REVOKED', revokedAt: now })
    .where(
      and(
        eq(betaApiKeys.id, input.keyId),
        eq(betaApiKeys.status, 'ACTIVE'),
      ),
    )
    .returning({ id: betaApiKeys.id, userId: betaApiKeys.userId })
  if (!key) throw new Error('beta_api_key_not_active')
  await db.insert(betaAuditEvents).values({
    userId: key.userId,
    actorType: 'ADMIN',
    actorId: input.actorId,
    action: 'API_KEY_REVOKED',
    targetType: 'API_KEY',
    targetId: key.id,
  })
  return key
}

export async function updatePublicBetaUser(input: {
  userId: string
  status?: 'ACTIVE' | 'SUSPENDED'
  maxBudgetUsdc?: number
  dailyRequestLimit?: number
  dailyBudgetUsdc?: number
  actorId: string
}) {
  const [user] = await db
    .update(betaUsers)
    .set({
      ...(input.status ? { status: input.status } : {}),
      ...(input.maxBudgetUsdc !== undefined
        ? { maxBudgetUsdc: input.maxBudgetUsdc }
        : {}),
      ...(input.dailyRequestLimit !== undefined
        ? { dailyRequestLimit: input.dailyRequestLimit }
        : {}),
      ...(input.dailyBudgetUsdc !== undefined
        ? { dailyBudgetUsdc: input.dailyBudgetUsdc }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(betaUsers.id, input.userId))
    .returning()
  if (!user) throw new Error('beta_user_not_found')
  if (input.status === 'SUSPENDED') {
    await db
      .update(betaSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(betaSessions.userId, input.userId),
          isNull(betaSessions.revokedAt),
        ),
      )
  }
  await db.insert(betaAuditEvents).values({
    userId: input.userId,
    actorType: 'ADMIN',
    actorId: input.actorId,
    action: 'BETA_USER_UPDATED',
    targetType: 'USER',
    targetId: input.userId,
    metadata: {
      status: input.status,
      maxBudgetUsdc: input.maxBudgetUsdc,
      dailyRequestLimit: input.dailyRequestLimit,
      dailyBudgetUsdc: input.dailyBudgetUsdc,
    },
  })
  return user
}

export async function listPublicBetaUsers() {
  return db
    .select({
      id: betaUsers.id,
      email: betaUsers.email,
      displayName: betaUsers.displayName,
      status: betaUsers.status,
      maxBudgetUsdc: betaUsers.maxBudgetUsdc,
      dailyRequestLimit: betaUsers.dailyRequestLimit,
      dailyBudgetUsdc: betaUsers.dailyBudgetUsdc,
      createdAt: betaUsers.createdAt,
    })
    .from(betaUsers)
    .orderBy(desc(betaUsers.createdAt))
    .limit(200)
}

export async function listPublicBetaApiKeys(userId: string) {
  return db
    .select({
      id: betaApiKeys.id,
      label: betaApiKeys.label,
      keyPrefix: betaApiKeys.keyPrefix,
      status: betaApiKeys.status,
      createdAt: betaApiKeys.createdAt,
      lastUsedAt: betaApiKeys.lastUsedAt,
      revokedAt: betaApiKeys.revokedAt,
    })
    .from(betaApiKeys)
    .where(eq(betaApiKeys.userId, userId))
    .orderBy(desc(betaApiKeys.createdAt))
}

export async function listPublicBetaAuditEvents(limit = 100) {
  return db
    .select()
    .from(betaAuditEvents)
    .orderBy(desc(betaAuditEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200))
}

export async function authenticatePublicBetaApiKey(
  apiKey: string,
): Promise<PublicBetaUser | undefined> {
  const keyHash = hashPublicBetaSecret(apiKey)
  const [result] = await db
    .select({
      keyId: betaApiKeys.id,
      userId: betaUsers.id,
      email: betaUsers.email,
      displayName: betaUsers.displayName,
      userStatus: betaUsers.status,
      keyStatus: betaApiKeys.status,
      maxBudgetUsdc: betaUsers.maxBudgetUsdc,
      dailyRequestLimit: betaUsers.dailyRequestLimit,
      dailyBudgetUsdc: betaUsers.dailyBudgetUsdc,
    })
    .from(betaApiKeys)
    .innerJoin(betaUsers, eq(betaUsers.id, betaApiKeys.userId))
    .where(eq(betaApiKeys.keyHash, keyHash))
    .limit(1)

  if (
    !result ||
    result.userStatus !== 'ACTIVE' ||
    result.keyStatus !== 'ACTIVE'
  ) {
    return undefined
  }

  await db
    .update(betaApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(betaApiKeys.id, result.keyId))

  return {
    id: result.userId,
    email: result.email,
    displayName: result.displayName,
    status: result.userStatus,
    maxBudgetUsdc: result.maxBudgetUsdc,
    dailyRequestLimit: result.dailyRequestLimit,
    dailyBudgetUsdc: result.dailyBudgetUsdc,
  }
}

export async function createPublicBetaSession(input: {
  userId: string
  ttlSeconds: number
}) {
  const token = generatePublicBetaSessionToken()
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000)
  const [session] = await db
    .insert(betaSessions)
    .values({
      userId: input.userId,
      tokenHash: hashPublicBetaSecret(token),
      expiresAt,
    })
    .returning({ id: betaSessions.id })
  if (!session) throw new Error('beta_session_not_created')
  return { token, expiresAt: expiresAt.toISOString() }
}

export async function authenticatePublicBetaSession(
  token: string,
): Promise<PublicBetaUser | undefined> {
  const tokenHash = hashPublicBetaSecret(token)
  const [result] = await db
    .select({
      sessionId: betaSessions.id,
      userId: betaUsers.id,
      email: betaUsers.email,
      displayName: betaUsers.displayName,
      status: betaUsers.status,
      maxBudgetUsdc: betaUsers.maxBudgetUsdc,
      dailyRequestLimit: betaUsers.dailyRequestLimit,
      dailyBudgetUsdc: betaUsers.dailyBudgetUsdc,
    })
    .from(betaSessions)
    .innerJoin(betaUsers, eq(betaUsers.id, betaSessions.userId))
    .where(
      and(
        eq(betaSessions.tokenHash, tokenHash),
        isNull(betaSessions.revokedAt),
        gt(betaSessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
  if (!result || result.status !== 'ACTIVE') return undefined

  await db
    .update(betaSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(betaSessions.id, result.sessionId))

  return {
    id: result.userId,
    email: result.email,
    displayName: result.displayName,
    status: result.status,
    maxBudgetUsdc: result.maxBudgetUsdc,
    dailyRequestLimit: result.dailyRequestLimit,
    dailyBudgetUsdc: result.dailyBudgetUsdc,
  }
}

export async function revokePublicBetaSession(token: string) {
  await db
    .update(betaSessions)
    .set({ revokedAt: new Date() })
    .where(eq(betaSessions.tokenHash, hashPublicBetaSecret(token)))
}

export function bearerToken(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice(7).trim()
  return token || undefined
}
