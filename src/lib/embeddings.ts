import { createHash } from 'node:crypto'
import { env, hasLiveAnthropicKey } from '../env.js'

const EMBEDDING_DIMENSIONS = 1536

function deterministicEmbedding(text: string) {
  const values: number[] = []
  let seed = createHash('sha256').update(text).digest()

  for (let i = 0; i < EMBEDDING_DIMENSIONS; i += 1) {
    if (i % seed.length === 0) {
      seed = createHash('sha256')
        .update(seed)
        .update(String(i))
        .digest()
    }
    values.push(seed[i % seed.length] / 127.5 - 1)
  }

  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
  return values.map((value) => Number((value / norm).toFixed(8)))
}

function fitDimensions(embedding: number[]) {
  if (embedding.length === EMBEDDING_DIMENSIONS) return embedding
  if (embedding.length > EMBEDDING_DIMENSIONS) return embedding.slice(0, EMBEDDING_DIMENSIONS)
  return embedding.concat(Array.from({ length: EMBEDDING_DIMENSIONS - embedding.length }, () => 0))
}

export async function embed(text: string): Promise<number[]> {
  if (!hasLiveAnthropicKey()) {
    return deterministicEmbedding(text)
  }

  const response = await fetch('https://api.anthropic.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'voyage-3',
      input: text,
    }),
  })

  const raw = await response.text()
  if (!response.ok) {
    if (env.NODE_ENV !== 'production') return deterministicEmbedding(text)
    throw new Error(`Anthropic embedding request failed (${response.status}): ${raw}`)
  }

  const body = JSON.parse(raw) as {
    embedding?: number[]
    embeddings?: number[][]
    data?: Array<{ embedding?: number[] }>
  }
  const embedding = body.embedding ?? body.embeddings?.[0] ?? body.data?.[0]?.embedding

  if (!Array.isArray(embedding)) {
    if (env.NODE_ENV !== 'production') return deterministicEmbedding(text)
    throw new Error('Anthropic embedding response did not include an embedding array')
  }

  return fitDimensions(embedding)
}
