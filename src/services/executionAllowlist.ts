import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  betaAuditEvents,
  endpoints,
  executionEndpointAllowlist,
} from '../db/schema.js'

export class ExecutionAllowlistError extends Error {
  constructor(
    public readonly code:
      | 'endpoint_not_found'
      | 'endpoint_not_allowlisted',
  ) {
    super(code)
  }
}

export async function executionEndpointAllowed(input: {
  endpointId: string | null
  endpointUrl: string | null
}) {
  if (!input.endpointId || !input.endpointUrl) return false
  const [entry] = await db
    .select({
      endpointUrl: executionEndpointAllowlist.endpointUrl,
      enabled: executionEndpointAllowlist.enabled,
    })
    .from(executionEndpointAllowlist)
    .where(eq(executionEndpointAllowlist.endpointId, input.endpointId))
    .limit(1)
  return Boolean(entry?.enabled && entry.endpointUrl === input.endpointUrl)
}

export async function listExecutionEndpointAllowlist() {
  return db
    .select()
    .from(executionEndpointAllowlist)
    .orderBy(desc(executionEndpointAllowlist.updatedAt))
}

export async function countEnabledExecutionEndpoints() {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionEndpointAllowlist)
    .where(eq(executionEndpointAllowlist.enabled, true))
  return Number(result?.count ?? 0)
}

export async function setExecutionEndpointAllowlist(input: {
  endpointId: string
  enabled: boolean
  reason: string
  actorId: string
}) {
  const [endpoint] = await db
    .select({
      id: endpoints.id,
      url: endpoints.url,
      name: endpoints.name,
      isActive: endpoints.isActive,
    })
    .from(endpoints)
    .where(eq(endpoints.id, input.endpointId))
    .limit(1)
  if (!endpoint) throw new ExecutionAllowlistError('endpoint_not_found')
  if (!endpoint.isActive && input.enabled) {
    throw new ExecutionAllowlistError('endpoint_not_allowlisted')
  }

  const [entry] = await db
    .insert(executionEndpointAllowlist)
    .values({
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      enabled: input.enabled,
      reason: input.reason,
      createdBy: input.actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: executionEndpointAllowlist.endpointId,
      set: {
        endpointUrl: endpoint.url,
        enabled: input.enabled,
        reason: input.reason,
        updatedAt: new Date(),
      },
    })
    .returning()
  await db.insert(betaAuditEvents).values({
    actorType: 'ADMIN',
    actorId: input.actorId,
    action: input.enabled ? 'ENDPOINT_ALLOWLISTED' : 'ENDPOINT_BLOCKED',
    targetType: 'ENDPOINT',
    targetId: endpoint.id,
    severity: 'SECURITY',
    metadata: { endpointUrl: endpoint.url, reason: input.reason },
  })
  return { ...entry, endpointName: endpoint.name }
}
