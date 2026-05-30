import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  X402_WALLET_PRIVATE_KEY: z.string().min(1),
  X402_WALLET_ADDRESS: z.string().min(1),
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
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  throw new Error(`Invalid environment variables:\n${details}`)
}

export const env = parsed.data

export function hasLiveAnthropicKey() {
  return !env.ANTHROPIC_API_KEY.includes('placeholder')
}

export function hasLiveX402Wallet() {
  return (
    !env.X402_WALLET_PRIVATE_KEY.includes('placeholder') &&
    !env.X402_WALLET_ADDRESS.includes('placeholder')
  )
}
