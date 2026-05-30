export type EndpointCandidate = {
  id: string
  url: string
  name: string
  description: string
  category?: string
  priceUsdc: number
  avgRating: number
  ratingCount?: number
  avgLatencyMs: number
  inputSchema?: unknown
  similarity?: number
  score?: number
  rating?: number
  latencyMs?: number
}

export type IntentResult =
  | {
      success: true
      intent: string
      endpoint: EndpointCandidate
      dry?: boolean
      data?: unknown
      priceUsdc?: number
      txHash?: string | null
      latencyMs?: number
      eventId?: string
    }
  | {
      success: false
      error: 'budget_exceeded'
      required: number
      budget: number
    }
  | {
      success: false
      error: 'no_endpoint_found'
      intent: string
    }
  | {
      success: false
      error: string
      intent: string
      endpoint?: EndpointCandidate
      data?: unknown
      priceUsdc?: number
      txHash?: string | null
      latencyMs?: number
      eventId?: string
    }

export type X402Result =
  | {
      success: true
      data: unknown
      latencyMs: number
      priceUsdc: number
      txHash: string | null
    }
  | {
      success: false
      error: string
      status?: number
      data?: unknown
      latencyMs: number
      priceUsdc?: number
      txHash?: string | null
    }

export type FeedEvent = {
  score: number | null
  endpoint: string
  latencyMs?: number
  status: 'success' | 'error' | 'skipped'
}
