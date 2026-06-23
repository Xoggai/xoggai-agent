import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  betaAuditEvents,
  betaExecutionRequests,
} from '../db/schema.js'

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

export async function createPublicBetaExecutionRequest(input: {
  userId: string
  intent: string
  budgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
  endpoint?: {
    id: string
    name: string
    url: string
    priceUsdc: number
  }
}) {
  const request = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`,
    )
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
      })
      .returning()
    return created
  })
  if (!request) throw new Error('beta_execution_request_not_created')
  await db.insert(betaAuditEvents).values({
    userId: input.userId,
    actorType: 'USER',
    actorId: input.userId,
    action: 'EXECUTION_REQUESTED',
    targetType: 'EXECUTION_REQUEST',
    targetId: request.id,
    metadata: {
      budgetUsdc: input.budgetUsdc,
      endpointId: input.endpoint?.id,
    },
  })
  return request
}

export async function listPublicBetaExecutionRequests(input: {
  userId: string
  limit: number
}) {
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
  const query = db.select().from(betaExecutionRequests)
  return input.status
    ? query
        .where(eq(betaExecutionRequests.status, input.status))
        .orderBy(desc(betaExecutionRequests.createdAt))
        .limit(input.limit)
    : query.orderBy(desc(betaExecutionRequests.createdAt)).limit(input.limit)
}

export async function decidePublicBetaExecutionRequest(input: {
  id: string
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED'
  reason?: string
  approvedBy: string
}) {
  const now = new Date()
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
