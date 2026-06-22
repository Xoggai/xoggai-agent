import { pathToFileURL } from 'node:url'

const MAX_PREPARE_BUDGET_USDC = 0.005

function apiBaseFromEnv(env) {
  const apiBase = env.XOGGAI_API_BASE || 'http://localhost:3000'
  const baseUrl = new URL(apiBase)

  if (
    baseUrl.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(baseUrl.hostname)
  ) {
    throw new Error('XOGGAI_API_BASE must use HTTPS unless it targets localhost')
  }

  return baseUrl
}

function requireBetaKey(env) {
  const betaKey = env.BETA_EXECUTION_KEY
  if (!betaKey || betaKey.length < 32) {
    throw new Error('BETA_EXECUTION_KEY must contain at least 32 characters')
  }
  return betaKey
}

function endpoint(baseUrl, path) {
  return new URL(path, `${baseUrl.toString().replace(/\/$/, '')}/`)
}

async function parseJsonResponse(response, label) {
  const responseText = await response.text()
  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error(
      `${label} returned non-JSON (${response.status}): ${responseText.slice(0, 200)}`,
    )
  }
}

function assertNoPayment(body) {
  if (body.paymentSigned !== false || body.paymentSent !== false) {
    throw new Error(
      'Safety assertion failed: paymentSigned and paymentSent must both be false',
    )
  }
}

function assertNotSent(body) {
  if (body.paymentSent !== false) {
    throw new Error('Safety assertion failed: paymentSent must be false')
  }
}

async function postJson({
  baseUrl,
  path,
  betaKey,
  body,
  fetchImpl,
  label,
  allowSignature = false,
}) {
  const response = await fetchImpl(endpoint(baseUrl, path), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-beta-key': betaKey,
    },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })

  const parsed = await parseJsonResponse(response, label)
  if (allowSignature) {
    assertNotSent(parsed)
  } else {
    assertNoPayment(parsed)
  }

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(parsed)}`)
  }

  return { response, body: parsed }
}

export async function runOperatorCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const command = argv[0] || 'status'
  const baseUrl = apiBaseFromEnv(env)

  if (command === 'status') {
    const response = await fetchImpl(endpoint(baseUrl, '/api/execution-status'), {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    const body = await parseJsonResponse(response, 'Execution status')
    if (!response.ok) {
      throw new Error(
        `Execution status failed (${response.status}): ${JSON.stringify(body)}`,
      )
    }
    if (body.paymentSendingEnabled !== false) {
      throw new Error(
        'Safety assertion failed: payment sending must be disabled',
      )
    }
    log(JSON.stringify(body, null, 2))
    return body
  }

  const betaKey = requireBetaKey(env)

  if (command === 'prepare') {
    const budget = Number(env.TEST_X402_BUDGET || argv[1] || String(MAX_PREPARE_BUDGET_USDC))
    if (
      !Number.isFinite(budget) ||
      budget <= 0 ||
      budget > MAX_PREPARE_BUDGET_USDC
    ) {
      throw new Error('Prepare budget must be between 0 and 0.005 USDC')
    }

    const { response, body } = await postJson({
      baseUrl,
      path: '/execute/prepare',
      betaKey,
      body: { budget },
      fetchImpl,
      label: 'Prepare',
    })

    if (body.mode !== 'prepare-only' || body.paymentPrepared !== true) {
      throw new Error(`Unexpected prepare response: ${JSON.stringify(body)}`)
    }

    const summary = {
      status: response.status,
      requestId: body.requestId,
      mode: body.mode,
      paymentPrepared: body.paymentPrepared,
      paymentSigned: body.paymentSigned,
      paymentSent: body.paymentSent,
      ticket: body.ticket,
      preview: body.preview,
    }
    log(JSON.stringify(summary, null, 2))
    return summary
  }

  if (command === 'approve') {
    const ticketId = argv[1] || env.X402_TICKET_ID
    if (!ticketId) {
      throw new Error('approve requires a ticket id argument or X402_TICKET_ID')
    }

    const { body } = await postJson({
      baseUrl,
      path: '/execute/approve',
      betaKey,
      body: {
        ticketId,
        approvedBy: env.X402_OPERATOR || 'operator-cli',
      },
      fetchImpl,
      label: 'Approve',
    })

    if (body.mode !== 'approval-only' || body.paymentApproved !== true) {
      throw new Error(`Unexpected approve response: ${JSON.stringify(body)}`)
    }

    log(JSON.stringify(body, null, 2))
    return body
  }

  if (command === 'consume') {
    const ticketId = argv[1] || env.X402_TICKET_ID
    if (!ticketId) {
      throw new Error('consume requires a ticket id argument or X402_TICKET_ID')
    }

    const { body } = await postJson({
      baseUrl,
      path: '/execute/consume',
      betaKey,
      body: {
        ticketId,
        consumedBy: env.X402_OPERATOR || 'operator-cli',
      },
      fetchImpl,
      label: 'Consume',
    })

    if (body.mode !== 'consume-only' || body.paymentConsumed !== true) {
      throw new Error(`Unexpected consume response: ${JSON.stringify(body)}`)
    }

    log(JSON.stringify(body, null, 2))
    return body
  }

  if (command === 'sign') {
    const ticketId = argv[1] || env.X402_TICKET_ID
    if (!ticketId) {
      throw new Error('sign requires a ticket id argument or X402_TICKET_ID')
    }

    const { body } = await postJson({
      baseUrl,
      path: '/execute/sign',
      betaKey,
      body: {
        ticketId,
        signedBy: env.X402_OPERATOR || 'operator-cli',
      },
      fetchImpl,
      label: 'Sign',
      allowSignature: true,
    })

    if (body.mode !== 'sign-only' || body.paymentSigned !== true) {
      throw new Error(`Unexpected sign response: ${JSON.stringify(body)}`)
    }

    const output =
      env.X402_REVEAL_PAYMENT_CREDENTIAL === 'true'
        ? body
        : {
            ...body,
            credential: {
              signerAddress: body.credential?.signerAddress,
              signatureHash: body.credential?.signatureHash,
              paymentPayload: {
                x402Version: body.credential?.paymentPayload?.x402Version,
                resource: body.credential?.paymentPayload?.resource,
                accepted: body.credential?.paymentPayload?.accepted,
                payload: {
                  authorization:
                    body.credential?.paymentPayload?.payload?.authorization,
                  signature: '[REDACTED]',
                },
              },
            },
          }
    log(JSON.stringify(output, null, 2))
    return body
  }

  throw new Error(
    'Unknown command. Use one of: status, prepare, approve <ticketId>, consume <ticketId>, sign <ticketId>',
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runOperatorCli()
}
