import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_BASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  ANTHROPIC_ROUTER_MODEL: z.string().min(1).default('claude-sonnet-4-5'),
  ANTHROPIC_RATING_MODEL: z.string().min(1).default('claude-haiku-4-5-20251001'),
  X402_WALLET_PRIVATE_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  X402_WALLET_ADDRESS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  X402_NETWORK: z.enum(['base-mainnet', 'base-sepolia']).default('base-mainnet'),
  ALLOWED_ORIGINS: z.string().min(1),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  STATS_CACHE_TTL: z.coerce.number().int().positive().default(30),
  SEARCH_CACHE_TTL: z.coerce.number().int().positive().default(60),
  ALLOW_LIVE_EXECUTION: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  EXECUTION_SIMULATION_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  X402_PREPARE_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  BETA_EXECUTION_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  MAX_EXECUTION_BUDGET_USDC: z.coerce.number().positive().max(10).default(0.05),
  EXECUTION_ENDPOINT_ALLOWLIST: z.string().default(''),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  throw new Error(`Invalid environment variables:\n${details}`)
}

if (parsed.data.ALLOW_LIVE_EXECUTION) {
  throw new Error(
    'ALLOW_LIVE_EXECUTION=true is not supported until the payment path is implemented and audited',
  )
}

export const env = parsed.data

export function hasLiveAnthropicKey() {
  return !env.ANTHROPIC_API_KEY.includes('placeholder')
}

export function hasLiveX402Wallet() {
  return (
    Boolean(env.X402_WALLET_PRIVATE_KEY) &&
    Boolean(env.X402_WALLET_ADDRESS) &&
    !env.X402_WALLET_PRIVATE_KEY?.includes('placeholder') &&
    !env.X402_WALLET_ADDRESS?.includes('placeholder')
  )
}

export function executionEndpointAllowlist() {
  return new Set(
    env.EXECUTION_ENDPOINT_ALLOWLIST.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}
