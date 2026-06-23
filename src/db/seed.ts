import { sql } from 'drizzle-orm'
import { db, pool } from './client.js'
import { endpoints, stats } from './schema.js'
import { embed } from '../lib/embeddings.js'
import { redis } from '../lib/redis.js'
import { auditedX402Candidate } from '../config/auditedX402.js'

const seedEndpoints = [
  {
    url: auditedX402Candidate.resourceUrl,
    name: auditedX402Candidate.name,
    description:
      'Audited Base Sepolia x402 sandbox endpoint that returns a deterministic fortune response.',
    category: 'utility',
    priceUsdc: 0.002,
    avgRating: 5,
    ratingCount: 1,
    avgLatencyMs: 250,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    url: '1c09pdnrx1.execute-api.us-east-1.amazonaws.com/v1/price/token',
    name: 'Token Price Oracle',
    description: 'Returns complete token price data for BTC, ETH, and other symbols.',
    category: 'crypto',
    priceUsdc: 0.001,
    avgRating: 5,
    ratingCount: 12,
    avgLatencyMs: 11,
    inputSchema: { type: 'object', properties: { symbol: { type: 'string' } } },
  },
  {
    url: 'chat.anchor-x402.com/v1/price/token',
    name: 'Anchor Token Price',
    description: 'Core crypto price data with USD price, 24h change, market cap, source, and timestamp.',
    category: 'crypto',
    priceUsdc: 0.001,
    avgRating: 4.8,
    ratingCount: 25,
    avgLatencyMs: 14,
    inputSchema: { type: 'object', properties: { symbol: { type: 'string' } } },
  },
  {
    url: 'api.anchor-x402.com/v1/price/token',
    name: 'Anchor API Price Token',
    description: 'Fast x402 token price endpoint for current cryptocurrency market snapshots.',
    category: 'crypto',
    priceUsdc: 0.001,
    avgRating: 4.8,
    ratingCount: 18,
    avgLatencyMs: 13,
    inputSchema: { type: 'object', properties: { symbol: { type: 'string' } } },
  },
  {
    url: 'pro-api.coingecko.com/api/v3/x402/simple/price',
    name: 'CoinGecko Simple Price',
    description: 'CoinGecko x402 endpoint for simple price and market data by symbol or coin ID.',
    category: 'crypto',
    priceUsdc: 0.01,
    avgRating: 4.8,
    ratingCount: 20,
    avgLatencyMs: 20,
    inputSchema: {
      type: 'object',
      properties: {
        symbols: { type: 'string' },
        vs_currencies: { type: 'string', default: 'usd' },
      },
    },
  },
  {
    url: 'stablecrypto.dev/api/coingecko/markets',
    name: 'CoinGecko Markets',
    description: 'Top cryptocurrency market data by market cap with price, volume, and trend fields.',
    category: 'crypto',
    priceUsdc: 0.001,
    avgRating: 4.8,
    ratingCount: 31,
    avgLatencyMs: 18,
    inputSchema: { type: 'object', properties: { page: { type: 'integer' } } },
  },
  {
    url: 'defi-api.agenticfi.wtf/api/token/trending',
    name: 'Trending DeFi Tokens',
    description: 'Currently trending DeFi tokens with volume, price movement, and market activity.',
    category: 'defi',
    priceUsdc: 0.001,
    avgRating: 4.8,
    ratingCount: 22,
    avgLatencyMs: 24,
    inputSchema: { type: 'object', properties: { chain: { type: 'string' } } },
  },
  {
    url: 'api.nansen.ai/api/v1/tgm/token-information',
    name: 'Nansen Token Info',
    description: 'On-chain token analytics and smart money token information.',
    category: 'analytics',
    priceUsdc: 0.005,
    avgRating: 4.8,
    ratingCount: 16,
    avgLatencyMs: 19,
    inputSchema: { type: 'object', properties: { token: { type: 'string' } } },
  },
  {
    url: 'api.nansen.ai/api/v1/nansen-score/top-tokens',
    name: 'Nansen Top Tokens',
    description: 'Top tokens ranked by Nansen score and on-chain analytics signals.',
    category: 'analytics',
    priceUsdc: 0.005,
    avgRating: 4.7,
    ratingCount: 15,
    avgLatencyMs: 21,
    inputSchema: { type: 'object', properties: { chain: { type: 'string' } } },
  },
  {
    url: 'twitter.surf.cascade.fyi/users/{ref}',
    name: 'Twitter User Profile',
    description: 'Returns public Twitter user profile fields, verification status, and public metrics.',
    category: 'social',
    priceUsdc: 0.002,
    avgRating: 5,
    ratingCount: 30,
    avgLatencyMs: 16,
    inputSchema: { type: 'object', properties: { ref: { type: 'string' } } },
  },
  {
    url: 'surf.cascade.fyi/api/v1/twitter/user',
    name: 'Twitter Profile and Tweets',
    description: 'Returns complete Twitter user profiles with paginated tweet collections.',
    category: 'social',
    priceUsdc: 0.002,
    avgRating: 5,
    ratingCount: 24,
    avgLatencyMs: 18,
    inputSchema: { type: 'object', properties: { username: { type: 'string' } } },
  },
  {
    url: 'httpay.xyz/api/news/crypto',
    name: 'Crypto News Feed',
    description: 'Latest crypto headlines with title, link, source, and snippet.',
    category: 'news',
    priceUsdc: 0.002,
    avgRating: 4.6,
    ratingCount: 19,
    avgLatencyMs: 8,
    inputSchema: { type: 'object', properties: { topic: { type: 'string' } } },
  },
]

async function main() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`)

  for (const endpoint of seedEndpoints) {
    const embedding = await embed(`${endpoint.name}. ${endpoint.description}`)
    await db
      .insert(endpoints)
      .values({
        ...endpoint,
        isActive: true,
        embedding,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: endpoints.url,
        set: {
          name: endpoint.name,
          description: endpoint.description,
          category: endpoint.category,
          priceUsdc: endpoint.priceUsdc,
          avgRating: endpoint.avgRating,
          ratingCount: endpoint.ratingCount,
          avgLatencyMs: endpoint.avgLatencyMs,
          inputSchema: endpoint.inputSchema,
          embedding,
          isActive: true,
          updatedAt: new Date(),
        },
      })
  }

  await db.insert(stats).values({ id: 1 }).onConflictDoNothing()
  console.log(`Seeded ${seedEndpoints.length} endpoints`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    redis.disconnect()
    await pool.end()
  })
