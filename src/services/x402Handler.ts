import { env, hasLiveAnthropicKey } from '../env.js'
import {
  ANTHROPIC_ROUTER_MODEL,
  anthropic,
  extractAnthropicText,
} from '../lib/anthropic.js'
import { x402Pay } from '../lib/x402.js'
import type { EndpointCandidate, X402Result } from './types.js'

function normalizeEndpointUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

function paymentField(body: unknown, field: string) {
  if (body && typeof body === 'object' && field in body) {
    return (body as Record<string, unknown>)[field]
  }
  return undefined
}

function parsePaymentRequired(body: unknown) {
  const accepts = paymentField(body, 'accepts')
  const firstAccept =
    Array.isArray(accepts) && accepts[0] && typeof accepts[0] === 'object'
      ? (accepts[0] as Record<string, unknown>)
      : undefined

  const priceRaw =
    paymentField(body, 'price') ??
    paymentField(body, 'amount') ??
    firstAccept?.price ??
    firstAccept?.amount
  const maxAmountRequired = firstAccept?.maxAmountRequired
  const payTo =
    paymentField(body, 'payTo') ??
    paymentField(body, 'pay_to') ??
    firstAccept?.payTo ??
    firstAccept?.payToAddress
  const price =
    priceRaw === undefined && maxAmountRequired !== undefined
      ? Number(maxAmountRequired) / 1_000_000
      : Number(priceRaw)

  return {
    price,
    payTo: typeof payTo === 'string' ? payTo : undefined,
    paymentDetails: firstAccept,
  }
}

export async function buildEndpointUrl(endpoint: EndpointCandidate, intent: string) {
  const baseUrl = normalizeEndpointUrl(endpoint.url)

  if (!hasLiveAnthropicKey()) return baseUrl

  const prompt = `Given the endpoint and user intent, return ONLY a JSON object {"url":"..."} with the fully-formed URL including query params derived from the intent.

Endpoint URL: ${baseUrl}
Input schema: ${JSON.stringify(endpoint.inputSchema ?? null)}
Intent: "${intent}"`

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_ROUTER_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const parsed = JSON.parse(extractAnthropicText(message.content)) as { url?: string }
    if (parsed.url && /^https?:\/\//i.test(parsed.url)) return parsed.url
  } catch (error) {
    if (env.NODE_ENV === 'production') throw error
  }

  return baseUrl
}

export async function x402Handler(opts: {
  endpoint: EndpointCandidate
  intent: string
}): Promise<X402Result> {
  const start = Date.now()
  const url = await buildEndpointUrl(opts.endpoint, opts.intent)

  try {
    const probe = await fetch(url, { signal: AbortSignal.timeout(15_000) })

    if (probe.status !== 402) {
      const data = await readJson(probe)
      return {
        success: probe.ok,
        data,
        latencyMs: Date.now() - start,
        priceUsdc: 0,
        txHash: null,
        ...(probe.ok ? {} : { error: 'upstream_error', status: probe.status }),
      } as X402Result
    }

    const paymentRequired = await readJson(probe)
    const { price, payTo, paymentDetails } = parsePaymentRequired(paymentRequired)

    if (!Number.isFinite(price) || !payTo) {
      return {
        success: false,
        error: 'invalid_payment_required',
        data: paymentRequired,
        latencyMs: Date.now() - start,
      }
    }

    if (price > opts.endpoint.priceUsdc * 1.2) {
      return { success: false, error: 'price_spike', latencyMs: Date.now() - start }
    }

    const { receipt, txHash } = await x402Pay({
      payTo,
      amount: price,
      currency: 'USDC',
      network: env.X402_NETWORK,
      paymentDetails,
    })

    const response = await fetch(url, {
      headers: { 'X-Payment': receipt },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      return {
        success: false,
        error: 'upstream_error',
        status: response.status,
        data: await readJson(response),
        latencyMs: Date.now() - start,
        priceUsdc: price,
        txHash,
      }
    }

    return {
      success: true,
      data: await readJson(response),
      latencyMs: Date.now() - start,
      priceUsdc: price,
      txHash,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'request_failed',
      latencyMs: Date.now() - start,
    }
  }
}
