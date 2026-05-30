import { createHash } from 'node:crypto'

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

export async function embed(text: string): Promise<number[]> {
  return deterministicEmbedding(text)
}
