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
  X402_SIGNING_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  X402_VERIFY_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  X402_FACILITATOR_URL: z
    .string()
    .url()
    .default('https://x402.org/facilitator'),
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

if (parsed.data.X402_SIGNING_ENABLED) {
  if (!parsed.data.X402_PREPARE_ENABLED) {
    throw new Error(
      'X402_SIGNING_ENABLED=true requires X402_PREPARE_ENABLED=true',
    )
  }
  if (parsed.data.X402_NETWORK !== 'base-sepolia') {
    throw new Error(
      'X402_SIGNING_ENABLED=true is restricted to base-sepolia',
    )
  }
  if (
    !parsed.data.X402_WALLET_PRIVATE_KEY ||
    !parsed.data.X402_WALLET_ADDRESS
  ) {
    throw new Error(
      'X402_SIGNING_ENABLED=true requires an isolated testnet wallet',
    )
  }
  if (
    !/^0x[0-9a-fA-F]{64}$/.test(parsed.data.X402_WALLET_PRIVATE_KEY) ||
    !/^0x[0-9a-fA-F]{40}$/.test(parsed.data.X402_WALLET_ADDRESS)
  ) {
    throw new Error(
      'X402 signing wallet key or address has an invalid EVM format',
    )
  }
}

if (parsed.data.X402_VERIFY_ENABLED) {
  if (!parsed.data.X402_SIGNING_ENABLED) {
    throw new Error(
      'X402_VERIFY_ENABLED=true requires X402_SIGNING_ENABLED=true',
    )
  }
  const facilitatorUrl = new URL(parsed.data.X402_FACILITATOR_URL)
  if (facilitatorUrl.protocol !== 'https:') {
    throw new Error('X402_FACILITATOR_URL must use HTTPS')
  }
  if (facilitatorUrl.hostname !== 'x402.org') {
    throw new Error(
      'X402 verification is restricted to the audited x402.org facilitator',
    )
  }
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
