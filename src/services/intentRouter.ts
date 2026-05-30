import { sql } from 'drizzle-orm'
import { env, hasLiveAnthropicKey } from '../env.js'
import {
  ANTHROPIC_ROUTER_MODEL,
  anthropic,
  extractAnthropicText,
} from '../lib/anthropic.js'
import { db } from '../db/client.js'
import { routingEvents } from '../db/schema.js'
import { embed } from '../lib/embeddings.js'
import { ratingQueue } from '../lib/queue.js'
import { rowsOf } from '../lib/query.js'
import { feedPublisher } from './feedPublisher.js'
import type { EndpointCandidate, IntentResult } from './types.js'
import { x402Handler } from './x402Handler.js'

type CandidateRow = {
  id: string
  url: string
  name: string
  description: string
  category?: string
  price_usdc: number | string
  avg_rating: number | string
  rating_count?: number | string
  avg_latency_ms: number | string
  input_schema?: unknown
  similarity: number | string
}

function toCandidate(row: CandidateRow): EndpointCandidate {
  const avgRating = Number(row.avg_rating)
  const avgLatencyMs = Number(row.avg_latency_ms)
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    description: row.description,
    category: row.category,
    priceUsdc: Number(row.price_usdc),
    avgRating,
    rating: avgRating,
    ratingCount: row.rating_count === undefined ? undefined : Number(row.rating_count),
    avgLatencyMs,
    latencyMs: avgLatencyMs,
    inputSchema: row.input_schema,
    similarity: Number(row.similarity),
  }
}

function heuristicBest(candidates: EndpointCandidate[]) {
  return [...candidates].sort((a, b) => {
    const scoreA =
      0.55 * (a.similarity ?? 0) +
      0.3 * (a.avgRating / 5) +
      0.1 * (1 / Math.max(a.priceUsdc, 0.0001)) +
      0.05 * (1 / Math.max(a.avgLatencyMs, 1))
    const scoreB =
      0.55 * (b.similarity ?? 0) +
      0.3 * (b.avgRating / 5) +
      0.1 * (1 / Math.max(b.priceUsdc, 0.0001)) +
      0.05 * (1 / Math.max(b.avgLatencyMs, 1))
    return scoreB - scoreA
  })[0]
}

async function llmRerank(intent: string, candidates: EndpointCandidate[]) {
  if (!hasLiveAnthropicKey()) return heuristicBest(candidates)

  const userMessage = `Intent: "${intent}"
Candidates:
${candidates
  .map(
    (c, i) =>
      `${i}. ${c.url} - ${c.description} (rating: ${c.avgRating}, price: $${c.priceUsdc})`,
  )
  .join('\n')}`

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_ROUTER_MODEL,
      max_tokens: 80,
      system:
        'You are an API routing engine. Given a user intent and a list of candidate x402 API endpoints, return ONLY a JSON object with one field "index" containing the 0-based index of the single best endpoint for this intent. Consider: relevance to intent, rating score, price, and latency. No explanation.',
      messages: [{ role: 'user', content: userMessage }],
    })

    const parsed = JSON.parse(extractAnthropicText(message.content)) as { index: number }
    const selected = candidates[parsed.index]
    return selected ?? heuristicBest(candidates)
  } catch (error) {
    console.error('LLM rerank failed, using heuristic fallback', error)
    return heuristicBest(candidates)
  }
}

async function findCandidates(embedding: number[], budget?: number) {
  const budgetFilter = budget === undefined ? sql`` : sql`AND price_usdc <= ${budget}`
  const result = await db.execute(sql`
    SELECT id, url, name, description, category, price_usdc, avg_rating, rating_count,
           avg_latency_ms, input_schema,
           1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM endpoints
    WHERE is_active = true
      AND embedding IS NOT NULL
      ${budgetFilter}
    ORDER BY similarity DESC
    LIMIT 20
  `)

  return rowsOf<CandidateRow>(result).map(toCandidate)
}

export async function intentRouter(opts: {
  q: string
  budget: number
  dry: boolean
}): Promise<IntentResult> {
  if (!opts.dry && !env.ALLOW_LIVE_EXECUTION) {
    return {
      success: false,
      error: 'live_execution_disabled',
      intent: opts.q,
    }
  }

  const embedding = await embed(opts.q)
  const candidates = await findCandidates(embedding, opts.budget)

  if (candidates.length === 0) {
    const overBudgetCandidates = await findCandidates(embedding)
    const cheapest = overBudgetCandidates.sort((a, b) => a.priceUsdc - b.priceUsdc)[0]

    if (cheapest && cheapest.priceUsdc > opts.budget) {
      return {
        success: false,
        error: 'budget_exceeded',
        required: cheapest.priceUsdc,
        budget: opts.budget,
      }
    }

    return { success: false, error: 'no_endpoint_found', intent: opts.q }
  }

  const best = await llmRerank(opts.q, candidates)

  if (opts.dry) {
    return { success: true, intent: opts.q, endpoint: best, dry: true }
  }

  const result = await x402Handler({ endpoint: best, intent: opts.q })

  const [event] = await db
    .insert(routingEvents)
    .values({
      intent: opts.q,
      endpointId: best.id,
      endpointUrl: best.url,
      latencyMs: result.latencyMs,
      priceUsdc: result.priceUsdc,
      txHash: result.txHash,
      status: result.success ? 'success' : 'error',
      errorMessage: result.success ? null : result.error,
      rawResponse: result.success ? result.data : result.data ?? { error: result.error },
    })
    .returning()

  void ratingQueue
    .add('rate', { eventId: event.id, intent: opts.q, response: result.success ? result.data : result })
    .catch((error: unknown) => {
      console.error('Failed to enqueue rating job', error)
    })

  await feedPublisher.publish({
    score: null,
    endpoint: best.url,
    latencyMs: result.latencyMs,
    status: result.success ? 'success' : 'error',
  })

  return {
    success: result.success,
    intent: opts.q,
    endpoint: best,
    data: result.success ? result.data : result.data,
    priceUsdc: result.priceUsdc,
    txHash: result.txHash,
    latencyMs: result.latencyMs,
    eventId: event.id,
    ...(result.success ? {} : { error: result.error }),
  } as IntentResult
}
