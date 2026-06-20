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
    maxTimeoutSeconds: integer('max_timeout_seconds').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
  },
  (t) => ({
    statusIdx: index('payment_prepare_tickets_status_idx').on(t.status),
    expiresAtIdx: index('payment_prepare_tickets_expires_at_idx').on(
      t.expiresAt,
    ),
    challengeHashIdx: index('payment_prepare_tickets_challenge_hash_idx').on(
      t.challengeHash,
    ),
  }),
)
