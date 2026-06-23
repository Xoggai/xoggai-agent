import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const vector = customType<{
  data: number[]
  driverData: string
  config: { dimensions: number }
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`
  },
  toDriver(value) {
    return `[${value.join(',')}]`
  },
})

export const endpoints = pgTable(
  'endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    priceUsdc: real('price_usdc').notNull(),
    avgRating: real('avg_rating').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    inputSchema: jsonb('input_schema').$type<Record<string, unknown> | null>(),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    ratingIdx: index('endpoints_rating_idx').on(t.avgRating),
  }),
)

export const routingEvents = pgTable('routing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  intent: text('intent').notNull(),
  endpointId: uuid('endpoint_id').references(() => endpoints.id),
  endpointUrl: text('endpoint_url').notNull(),
  latencyMs: integer('latency_ms'),
  priceUsdc: real('price_usdc'),
  txHash: text('tx_hash'),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  rating: real('rating'),
  ratingReason: text('rating_reason'),
  rawResponse: jsonb('raw_response').$type<unknown>(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const stats = pgTable('stats', {
  id: integer('id').primaryKey().default(1),
  activeAgents: integer('active_agents').notNull().default(0),
  totalTx: integer('total_tx').notNull().default(0),
  apisConsumed: integer('apis_consumed').notNull().default(0),
  hoursSaved: real('hours_saved').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const betaUsers = pgTable('beta_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  maxBudgetUsdc: real('max_budget_usdc').notNull().default(0.005),
  dailyRequestLimit: integer('daily_request_limit').notNull().default(25),
  dailyBudgetUsdc: real('daily_budget_usdc').notNull().default(0.05),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const betaApiKeys = pgTable(
  'beta_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => betaUsers.id),
    label: text('label').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => ({
    userIdx: index('beta_api_keys_user_idx').on(t.userId),
  }),
)

export const betaSessions = pgTable(
  'beta_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => betaUsers.id),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => ({
    userIdx: index('beta_sessions_user_idx').on(t.userId),
    expiryIdx: index('beta_sessions_expiry_idx').on(t.expiresAt),
  }),
)

export const betaExecutionRequests = pgTable(
  'beta_execution_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => betaUsers.id),
    intent: text('intent').notNull(),
    budgetUsdc: real('budget_usdc').notNull(),
    endpointId: uuid('endpoint_id').references(() => endpoints.id),
    endpointName: text('endpoint_name'),
    endpointUrl: text('endpoint_url'),
    endpointPriceUsdc: real('endpoint_price_usdc'),
    idempotencyKeyHash: text('idempotency_key_hash'),
    requestFingerprint: text('request_fingerprint'),
    status: text('status').notNull().default('REQUESTED'),
    decisionReason: text('decision_reason'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at'),
    paymentTicketId: text('payment_ticket_id'),
    executionStatus: text('execution_status'),
    executionError: text('execution_error'),
    upstreamStatusCode: integer('upstream_status_code'),
    upstreamResponseHash: text('upstream_response_hash'),
    upstreamPaymentResponseHash: text('upstream_payment_response_hash'),
    settlementTransaction: text('settlement_transaction'),
    settlementNetwork: text('settlement_network'),
    executedAt: timestamp('executed_at'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('beta_execution_requests_user_idx').on(t.userId),
    userCreatedIdx: index('beta_execution_requests_user_created_idx').on(
      t.userId,
      t.createdAt,
    ),
    statusIdx: index('beta_execution_requests_status_idx').on(t.status),
    expiryIdx: index('beta_execution_requests_expiry_idx').on(t.expiresAt),
    userIdempotencyIdx: uniqueIndex(
      'beta_execution_requests_user_idempotency_idx',
    ).on(t.userId, t.idempotencyKeyHash),
  }),
)

export const betaAuditEvents = pgTable(
  'beta_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => betaUsers.id),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    requestId: text('request_id'),
    severity: text('severity').notNull().default('INFO'),
    outcome: text('outcome').notNull().default('SUCCESS'),
    sourceHash: text('source_hash'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('beta_audit_events_user_idx').on(t.userId),
    actionIdx: index('beta_audit_events_action_idx').on(t.action),
    createdIdx: index('beta_audit_events_created_idx').on(t.createdAt),
  }),
)

export const executionEndpointAllowlist = pgTable(
  'execution_endpoint_allowlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id),
    endpointUrl: text('endpoint_url').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    reason: text('reason').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    endpointIdx: uniqueIndex('execution_endpoint_allowlist_endpoint_idx').on(
      t.endpointId,
    ),
    enabledIdx: index('execution_endpoint_allowlist_enabled_idx').on(t.enabled),
  }),
)

export const paymentPrepareTickets = pgTable(
  'payment_prepare_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: text('request_id').notNull(),
    status: text('status').notNull().default('PREPARED'),
    challengeHash: text('challenge_hash').notNull(),
    resourceUrl: text('resource_url').notNull(),
    network: text('network').notNull(),
    asset: text('asset').notNull(),
    recipient: text('recipient').notNull(),
    amountAtomic: text('amount_atomic').notNull(),
    amountUsdc: real('amount_usdc').notNull(),
    budgetUsdc: real('budget_usdc').notNull(),
    betaKeyId: text('beta_key_id'),
    betaClientLabel: text('beta_client_label'),
    maxTimeoutSeconds: integer('max_timeout_seconds').notNull(),
    assetName: text('asset_name'),
    assetVersion: text('asset_version'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    approvedAt: timestamp('approved_at'),
    approvedBy: text('approved_by'),
    consumedAt: timestamp('consumed_at'),
    consumedBy: text('consumed_by'),
    signedAt: timestamp('signed_at'),
    signedBy: text('signed_by'),
    signerAddress: text('signer_address'),
    signatureHash: text('signature_hash'),
    verificationStatus: text('verification_status'),
    verificationReason: text('verification_reason'),
    verificationPayer: text('verification_payer'),
    verificationResultHash: text('verification_result_hash'),
    facilitatorUrl: text('facilitator_url'),
    verifiedAt: timestamp('verified_at'),
    verifiedBy: text('verified_by'),
    settlementStatus: text('settlement_status'),
    settlementErrorReason: text('settlement_error_reason'),
    settlementErrorMessage: text('settlement_error_message'),
    settlementTransaction: text('settlement_transaction'),
    settlementNetwork: text('settlement_network'),
    settlementResultHash: text('settlement_result_hash'),
    settlementStartedAt: timestamp('settlement_started_at'),
    settledAt: timestamp('settled_at'),
    settledBy: text('settled_by'),
    upstreamStatus: text('upstream_status'),
    upstreamStatusCode: integer('upstream_status_code'),
    upstreamErrorMessage: text('upstream_error_message'),
    upstreamResponseHash: text('upstream_response_hash'),
    upstreamPaymentResponseHash: text('upstream_payment_response_hash'),
    upstreamStartedAt: timestamp('upstream_started_at'),
    upstreamCompletedAt: timestamp('upstream_completed_at'),
    upstreamExecutedBy: text('upstream_executed_by'),
  },
  (t) => ({
    statusIdx: index('payment_prepare_tickets_status_idx').on(t.status),
    expiresAtIdx: index('payment_prepare_tickets_expires_at_idx').on(
      t.expiresAt,
    ),
    challengeHashIdx: index('payment_prepare_tickets_challenge_hash_idx').on(
      t.challengeHash,
    ),
    betaUsageIdx: index('payment_prepare_tickets_beta_usage_idx').on(
      t.betaKeyId,
      t.createdAt,
    ),
  }),
)
