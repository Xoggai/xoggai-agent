CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price_usdc real NOT NULL,
  avg_rating real NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  input_schema jsonb,
  embedding vector(1536),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS endpoints_embedding_idx
  ON endpoints USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS endpoints_rating_idx
  ON endpoints (avg_rating);

CREATE TABLE IF NOT EXISTS routing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text NOT NULL,
  endpoint_id uuid REFERENCES endpoints(id),
  endpoint_url text NOT NULL,
  latency_ms integer,
  price_usdc real,
  tx_hash text,
  status text NOT NULL,
  error_message text,
  rating real,
  rating_reason text,
  raw_response jsonb,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats (
  id integer PRIMARY KEY DEFAULT 1,
  active_agents integer NOT NULL DEFAULT 0,
  total_tx integer NOT NULL DEFAULT 0,
  apis_consumed integer NOT NULL DEFAULT 0,
  hours_saved real NOT NULL DEFAULT 0,
  updated_at timestamp DEFAULT now()
);

INSERT INTO stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS beta_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  max_budget_usdc real NOT NULL DEFAULT 0.005,
  daily_request_limit integer NOT NULL DEFAULT 25,
  daily_budget_usdc real NOT NULL DEFAULT 0.05,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS beta_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES beta_users(id),
  label text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamp NOT NULL DEFAULT now(),
  last_used_at timestamp,
  revoked_at timestamp
);

CREATE INDEX IF NOT EXISTS beta_api_keys_user_idx ON beta_api_keys (user_id);

CREATE TABLE IF NOT EXISTS beta_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES beta_users(id),
  token_hash text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  revoked_at timestamp
);

CREATE INDEX IF NOT EXISTS beta_sessions_user_idx ON beta_sessions (user_id);
CREATE INDEX IF NOT EXISTS beta_sessions_expiry_idx ON beta_sessions (expires_at);

CREATE TABLE IF NOT EXISTS beta_execution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES beta_users(id),
  intent text NOT NULL,
  budget_usdc real NOT NULL,
  endpoint_id uuid REFERENCES endpoints(id),
  endpoint_name text,
  endpoint_url text,
  endpoint_price_usdc real,
  status text NOT NULL DEFAULT 'REQUESTED',
  decision_reason text,
  approved_by text,
  approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beta_execution_requests_user_idx
  ON beta_execution_requests (user_id);
CREATE INDEX IF NOT EXISTS beta_execution_requests_user_created_idx
  ON beta_execution_requests (user_id, created_at);
CREATE INDEX IF NOT EXISTS beta_execution_requests_status_idx
  ON beta_execution_requests (status);

CREATE TABLE IF NOT EXISTS beta_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES beta_users(id),
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beta_audit_events_user_idx
  ON beta_audit_events (user_id);

CREATE TABLE IF NOT EXISTS payment_prepare_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  status text NOT NULL DEFAULT 'PREPARED',
  challenge_hash text NOT NULL,
  resource_url text NOT NULL,
  network text NOT NULL,
  asset text NOT NULL,
  recipient text NOT NULL,
  amount_atomic text NOT NULL,
  amount_usdc real NOT NULL,
  budget_usdc real NOT NULL,
  beta_key_id text,
  beta_client_label text,
  max_timeout_seconds integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  approved_at timestamp,
  approved_by text,
  consumed_at timestamp,
  consumed_by text
);

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS beta_key_id text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS beta_client_label text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS approved_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS approved_by text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS consumed_by text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS asset_name text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS asset_version text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS signed_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS signed_by text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS signer_address text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS signature_hash text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS verification_status text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS verification_reason text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS verification_payer text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS verification_result_hash text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS facilitator_url text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS verified_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS verified_by text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_status text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_error_reason text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_error_message text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_transaction text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_network text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_result_hash text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settlement_started_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settled_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS settled_by text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_status text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_status_code integer;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_error_message text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_response_hash text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_payment_response_hash text;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_started_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_completed_at timestamp;

ALTER TABLE payment_prepare_tickets
  ADD COLUMN IF NOT EXISTS upstream_executed_by text;

CREATE INDEX IF NOT EXISTS payment_prepare_tickets_status_idx
  ON payment_prepare_tickets (status);

CREATE INDEX IF NOT EXISTS payment_prepare_tickets_expires_at_idx
  ON payment_prepare_tickets (expires_at);

CREATE INDEX IF NOT EXISTS payment_prepare_tickets_challenge_hash_idx
  ON payment_prepare_tickets (challenge_hash);

CREATE INDEX IF NOT EXISTS payment_prepare_tickets_beta_usage_idx
  ON payment_prepare_tickets (beta_key_id, created_at);
