import { and, desc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  betaAuditEvents,
  betaExecutionRequests,
} from '../db/schema.js'
import {
  hashAbuseIdentifier,
  publicBetaRequestFingerprint,
} from './abuseProtection.js'

export type PublicBetaExecutionRequestStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'TESTNET_PREPARING'
  | 'TESTNET_PREPARED'
  | 'TESTNET_SIGNING'
  | 'TESTNET_VERIFYING'
  | 'TESTNET_EXECUTING'
  | 'EXECUTED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_UNKNOWN'
  | 'EXPIRED'

export class PublicBetaExecutionError extends Error {
  constructor(
    public readonly code:
      | 'beta_execution_request_not_found'
      | 'beta_execution_request_not_approved'
      | 'beta_execution_request_already_executing'
      | 'beta_execution_request_already_finished'
      | 'beta_execution_request_expired'
      | 'endpoint_not_allowlisted'
  ) {
    super(code)
  }
}

export async function publicBetaRequestUsage(input: {
  userId: string
  since: Date
}) {
  const [usage] = await db
    .select({
      requestCount: sql<number>`count(*)::int`,
      budgetUsdc: sql<number>`coalesce(sum(${betaExecutionRequests.budgetUsdc}), 0)::float`,
    })
    .from(betaExecutionRequests)
    .where(
      and(
        eq(betaExecutionRequests.userId, input.userId),
        gte(betaExecutionRequests.createdAt, input.since),
      ),
    )
  return {
    requestCount: Number(usage?.requestCount ?? 0),
    budgetUsdc: Number(usage?.budgetUsdc ?? 0),
  }
}

export class PublicBetaQuotaError extends Error {
  constructor(
    public readonly code:
      | 'daily_request_limit_exceeded'
      | 'daily_budget_exceeded',
  ) {
    super(code)
  }
}

export class PublicBetaIdempotencyError extends Error {
  constructor(public readonly code: 'idempotency_key_conflict') {
    super(code)
  }
}

export async function expireStalePublicBetaRequests(now = new Date()) {
  const expired = await db
    .update(betaExecutionRequests)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(
      and(
        inArray(betaExecutionRequests.status, ['REQUESTED', 'APPROVED']),
        lte(betaExecutionRequests.expiresAt, now),
      ),
    )
    .returning({
      id: betaExecutionRequests.id,
      userId: betaExecutionRequests.userId,
    })
  if (expired.length > 0) {
    await db.insert(betaAuditEvents).values(
      expired.map((request) => ({
        userId: request.userId,
        actorType: 'SYSTEM',
        actorId: 'phase13-expiry-worker',
        action: 'EXECUTION_REQUEST_EXPIRED',
        targetType: 'EXECUTION_REQUEST',
        targetId: request.id,
        severity: 'INFO',
        outcome: 'EXPIRED',
      })),
    )
  }
  return expired
}

export async function recordPublicBetaAuditEvent(input: {
  userId: string
  actorId: string
  action: string
  targetId?: string
  requestId?: string
  severity?: string
  outcome?: string
  sourceHash?: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(betaAuditEvents).values({
    userId: input.userId,
    actorType: 'USER',
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetId ? 'EXECUTION_REQUEST' : 'USER',
    targetId: input.targetId ?? input.userId,
    requestId: input.requestId,
    severity: input.severity ?? 'INFO',
    outcome: input.outcome ?? 'SUCCESS',
    sourceHash: input.sourceHash,
    metadata: input.metadata ?? null,
  })
}

export async function resolvePublicBetaIdempotency(input: {
  userId: string
  idempotencyKey: string
  intent: string
  budgetUsdc: number
}) {
  const idempotencyKeyHash = hashAbuseIdentifier(input.idempotencyKey)
  const fingerprint = publicBetaRequestFingerprint(input)
  const [existing] = await db
    .select()
    .from(betaExecutionRequests)
    .where(
      and(
        eq(betaExecutionRequests.userId, input.userId),
        eq(betaExecutionRequests.idempotencyKeyHash, idempotencyKeyHash),
      ),
    )
    .limit(1)
  if (!existing) return undefined
  if (existing.requestFingerprint !== fingerprint) {
    throw new PublicBetaIdempotencyError('idempotency_key_conflict')
  }
  return existing
}

export async function createPublicBetaExecutionRequest(input: {
  userId: string
  intent: string
  budgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
  idempotencyKey: string
  requestTtlSeconds: number
  requestId?: string
  sourceHash?: string
  endpoint?: {
    id: string
    name: string
    url: string
    priceUsdc: number
  }
}) {
  const idempotencyKeyHash = hashAbuseIdentifier(input.idempotencyKey)
  const requestFingerprint = publicBetaRequestFingerprint(input)
  const expiresAt = new Date(Date.now() + input.requestTtlSeconds * 1000)
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`,
    )
    const [existing] = await tx
      .select()
      .from(betaExecutionRequests)
      .where(
        and(
          eq(betaExecutionRequests.userId, input.userId),
          eq(betaExecutionRequests.idempotencyKeyHash, idempotencyKeyHash),
        ),
      )
      .limit(1)
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new PublicBetaIdempotencyError('idempotency_key_conflict')
      }
      return { request: existing, replayed: true }
    }
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const [usage] = await tx
      .select({
        requestCount: sql<number>`count(*)::int`,
        budgetUsdc: sql<number>`coalesce(sum(${betaExecutionRequests.budgetUsdc}), 0)::float`,
      })
      .from(betaExecutionRequests)
      .where(
        and(
          eq(betaExecutionRequests.userId, input.userId),
          gte(betaExecutionRequests.createdAt, since),
        ),
      )
    if (Number(usage?.requestCount ?? 0) >= input.dailyRequestLimit) {
      throw new PublicBetaQuotaError('daily_request_limit_exceeded')
    }
    if (
      Number(usage?.budgetUsdc ?? 0) + input.budgetUsdc >
      input.dailyBudgetUsdc
    ) {
      throw new PublicBetaQuotaError('daily_budget_exceeded')
    }
    const [created] = await tx
      .insert(betaExecutionRequests)
      .values({
        userId: input.userId,
        intent: input.intent,
        budgetUsdc: input.budgetUsdc,
        endpointId: input.endpoint?.id,
        endpointName: input.endpoint?.name,
        endpointUrl: input.endpoint?.url,
        endpointPriceUsdc: input.endpoint?.priceUsdc,
        idempotencyKeyHash,
        requestFingerprint,
        expiresAt,
      })
      .returning()
    return { request: created, replayed: false }
  })
  const request = result.request
  if (!request) throw new Error('beta_execution_request_not_created')
  await db.insert(betaAuditEvents).values({
    userId: input.userId,
    actorType: 'USER',
    actorId: input.userId,
    action: result.replayed
      ? 'EXECUTION_REQUEST_REPLAYED'
      : 'EXECUTION_REQUESTED',
    targetType: 'EXECUTION_REQUEST',
    targetId: request.id,
    requestId: input.requestId,
    outcome: result.replayed ? 'REPLAYED' : 'SUCCESS',
    sourceHash: input.sourceHash,
    metadata: {
      budgetUsdc: input.budgetUsdc,
      endpointId: input.endpoint?.id,
      expiresAt: request.expiresAt.toISOString(),
    },
  })
  return result
}

export async function listPublicBetaExecutionRequests(input: {
  userId: string
  limit: number
}) {
  await expireStalePublicBetaRequests()
  return db
    .select()
    .from(betaExecutionRequests)
    .where(eq(betaExecutionRequests.userId, input.userId))
    .orderBy(desc(betaExecutionRequests.createdAt))
    .limit(input.limit)
}

export async function listAdminBetaExecutionRequests(input: {
  status?: string
  limit: number
}) {
  await expireStalePublicBetaRequests()
  const query = db.select().from(betaExecutionRequests)
  return input.status
    ? query
        .where(eq(betaExecutionRequests.status, input.status))
        .orderBy(desc(betaExecutionRequests.createdAt))
        .limit(input.limit)
    : query.orderBy(desc(betaExecutionRequests.createdAt)).limit(input.limit)
}

export async function getPublicBetaExecutionRequest(id: string) {
  await expireStalePublicBetaRequests()
  const [request] = await db
    .select()
    .from(betaExecutionRequests)
    .where(eq(betaExecutionRequests.id, id))
    .limit(1)
  if (!request) {
    throw new PublicBetaExecutionError('beta_execution_request_not_found')
  }
  return request
}

export async function decidePublicBetaExecutionRequest(input: {
  id: string
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED'
  reason?: string
  approvedBy: string
}) {
  const now = new Date()
  await expireStalePublicBetaRequests(now)
  const [request] = await db
    .update(betaExecutionRequests)
    .set({
      status: input.status,
      decisionReason: input.reason,
      approvedBy: input.approvedBy,
      approvedAt: input.status === 'APPROVED' ? now : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(betaExecutionRequests.id, input.id),
        eq(betaExecutionRequests.status, 'REQUESTED'),
        gt(betaExecutionRequests.expiresAt, now),
      ),
    )
    .returning()
  if (!request) throw new Error('beta_execution_request_not_pending')
  await db.insert(betaAuditEvents).values({
    userId: request.userId,
    actorType: 'ADMIN',
    actorId: input.approvedBy,
    action: `EXECUTION_${input.status}`,
    targetType: 'EXECUTION_REQUEST',
    targetId: request.id,
    metadata: { reason: input.reason },
  })
  return request
}

export async function claimPublicBetaRequestForTestnetExecution(input: {
  id: string
  executedBy: string
}) {
  const now = new Date()
  await expireStalePublicBetaRequests(now)
  const [request] = await db
    .update(betaExecutionRequests)
    .set({
      status: 'TESTNET_PREPARING',
      executionStatus: 'TESTNET_PREPARING',
      executionError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(betaExecutionRequests.id, input.id),
        eq(betaExecutionRequests.status, 'APPROVED'),
        gt(betaExecutionRequests.expiresAt, now),
      ),
    )
    .returning()

  if (!request) {
    const [existing] = await db
      .select()
      .from(betaExecutionRequests)
      .where(eq(betaExecutionRequests.id, input.id))
      .limit(1)
    if (!existing) {
      throw new PublicBetaExecutionError(
        'beta_execution_request_not_found',
      )
    }
    if (
      [
        'TESTNET_PREPARING',
        'TESTNET_PREPARED',
        'TESTNET_SIGNING',
        'TESTNET_VERIFYING',
        'TESTNET_EXECUTING',
      ].includes(existing.status)
    ) {
      throw new PublicBetaExecutionError(
        'beta_execution_request_already_executing',
      )
    }
    if (
      ['EXECUTED', 'EXECUTION_FAILED', 'EXECUTION_UNKNOWN', 'EXPIRED'].includes(
        existing.status,
      )
    ) {
      if (existing.status === 'EXPIRED') {
        throw new PublicBetaExecutionError('beta_execution_request_expired')
      }
      throw new PublicBetaExecutionError(
        'beta_execution_request_already_finished',
      )
    }
    throw new PublicBetaExecutionError(
      'beta_execution_request_not_approved',
    )
  }

  await db.insert(betaAuditEvents).values({
    userId: request.userId,
    actorType: 'ADMIN',
    actorId: input.executedBy,
    action: 'TESTNET_EXECUTION_STARTED',
    targetType: 'EXECUTION_REQUEST',
    targetId: request.id,
    metadata: { endpointUrl: request.endpointUrl },
  })

  return request
}

export async function updatePublicBetaRequestExecution(input: {
  id: string
  status: PublicBetaExecutionRequestStatus
  paymentTicketId?: string
  executionError?: string | null
  upstreamStatusCode?: number
  upstreamResponseHash?: string
  upstreamPaymentResponseHash?: string
  settlementTransaction?: string
  settlementNetwork?: string
  executedAt?: Date
}) {
  const now = new Date()
  const [request] = await db
    .update(betaExecutionRequests)
    .set({
      status: input.status,
      executionStatus: input.status,
      ...(input.paymentTicketId
        ? { paymentTicketId: input.paymentTicketId }
        : {}),
      executionError: input.executionError ?? null,
      upstreamStatusCode: input.upstreamStatusCode ?? null,
      upstreamResponseHash: input.upstreamResponseHash ?? null,
      upstreamPaymentResponseHash:
        input.upstreamPaymentResponseHash ?? null,
      settlementTransaction: input.settlementTransaction ?? null,
      settlementNetwork: input.settlementNetwork ?? null,
      executedAt: input.executedAt ?? null,
      updatedAt: now,
    })
    .where(eq(betaExecutionRequests.id, input.id))
    .returning()

  if (!request) {
    throw new PublicBetaExecutionError('beta_execution_request_not_found')
  }

  return request
}

export async function auditPublicBetaRequestExecution(input: {
  userId: string
  requestId: string
  actorId: string
  action: string
  metadata?: Record<string, unknown>
  traceRequestId?: string
  severity?: string
  outcome?: string
}) {
  await db.insert(betaAuditEvents).values({
    userId: input.userId,
    actorType: 'ADMIN',
    actorId: input.actorId,
    action: input.action,
    targetType: 'EXECUTION_REQUEST',
    targetId: input.requestId,
    requestId: input.traceRequestId,
    severity: input.severity ?? 'INFO',
    outcome: input.outcome ?? 'SUCCESS',
    metadata: input.metadata ?? null,
  })
}
