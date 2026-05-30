const XOGGAI_API = process.env.XOGGAI_API ?? 'http://localhost:3000'

export async function routeIntent(intent: string, budget = 0.05) {
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

console.log(await routeIntent('what is the ETH price?'))
