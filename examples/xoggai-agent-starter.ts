import { pathToFileURL } from 'node:url'

const XOGGAI_API =
  process.env.XOGGAI_API ?? 'https://xoggai-backend.onrender.com'

export async function routeIntent(intent: string, budget = 0.005) {
  const url = new URL(`${XOGGAI_API}/intent`)
  url.searchParams.set('q', intent)
  url.searchParams.set('budget', String(budget))
  url.searchParams.set('dry', 'true')

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`XoggAI route failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

export async function searchEndpoints(query: string, limit = 5) {
  const url = new URL(`${XOGGAI_API}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('dry', 'true')

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`XoggAI search failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

export async function executionStatus() {
  const res = await fetch(`${XOGGAI_API}/api/execution-status`)
  if (!res.ok) {
    throw new Error(`XoggAI status failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await routeIntent('what is the ETH price?', 0.005))
}
