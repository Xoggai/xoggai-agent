import { pathToFileURL } from 'node:url'

export async function runPrepareCheck({
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const apiBase = env.XOGGAI_API_BASE || 'http://localhost:3000'
  const betaKey = env.BETA_EXECUTION_KEY
  const budget = Number(env.TEST_X402_BUDGET || '0.005')

  if (!betaKey || betaKey.length < 32) {
    throw new Error('BETA_EXECUTION_KEY must contain at least 32 characters')
  }

  if (!Number.isFinite(budget) || budget <= 0 || budget > 0.005) {
    throw new Error('TEST_X402_BUDGET must be between 0 and 0.005 USDC')
  }

  const baseUrl = new URL(apiBase)
  if (
    baseUrl.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(baseUrl.hostname)
  ) {
    throw new Error('XOGGAI_API_BASE must use HTTPS unless it targets localhost')
  }

  const response = await fetchImpl(
    new URL('/execute/prepare', `${baseUrl.toString().replace(/\/$/, '')}/`),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-beta-key': betaKey,
      },
      body: JSON.stringify({ budget }),
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    },
  )

  const responseText = await response.text()
  let body
  try {
    body = JSON.parse(responseText)
  } catch {
    throw new Error(
      `Prepare endpoint returned non-JSON (${response.status}): ${responseText.slice(0, 200)}`,
    )
  }

  if (body.paymentSigned !== false || body.paymentSent !== false) {
    throw new Error(
      'Safety assertion failed: paymentSigned and paymentSent must both be false',
    )
  }

  if (
    !response.ok ||
    body.mode !== 'prepare-only' ||
    body.paymentPrepared !== true
  ) {
    throw new Error(
      `Payment preparation failed (${response.status}): ${JSON.stringify(body)}`,
    )
  }

  const summary = {
    status: response.status,
    requestId: body.requestId,
    mode: body.mode,
    paymentPrepared: body.paymentPrepared,
    paymentSigned: body.paymentSigned,
    paymentSent: body.paymentSent,
    network: body.preview?.network,
    amountUsdc: body.preview?.amountUsdc,
    asset: body.preview?.asset,
    recipient: body.preview?.recipient,
    resourceUrl: body.preview?.resourceUrl,
  }

  log(JSON.stringify(summary, null, 2))
  return summary
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runPrepareCheck()
}
