import { pathToFileURL } from 'node:url'

const MAX_PREPARE_BUDGET_USDC = 0.005
const PHASE5_CONFIRMATION = 'EXECUTE_X402_BASE_SEPOLIA'

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

async function fetchExecutionStatus({ baseUrl, fetchImpl }) {
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
  return body
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

function addPhase5Check(checks, blockedBy, name, pass, detail) {
  checks.push({ name, pass, detail })
  if (!pass) {
    blockedBy.push(`${name}: ${detail}`)
  }
}

function buildPhase5Preflight({ baseUrl, status, env }) {
  const checks = []
  const blockedBy = []
  const budget = Number(status.maxExecutionBudgetUsdc)
  const betaKey = env.BETA_EXECUTION_KEY || ''

  addPhase5Check(
    checks,
    blockedBy,
    'api_base',
    baseUrl.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(baseUrl.hostname),
    `${baseUrl.toString().replace(/\/$/, '')} must be HTTPS unless local`,
  )
  addPhase5Check(
    checks,
    blockedBy,
    'safety_mode',
    status.safetyMode === 'testnet-upstream-execution',
    `expected testnet-upstream-execution, got ${status.safetyMode}`,
  )
  addPhase5Check(
    checks,
    blockedBy,
    'network',
    status.network === 'base-sepolia',
    `expected base-sepolia, got ${status.network}`,
  )
  addPhase5Check(
    checks,
    blockedBy,
    'prepare_enabled',
    status.prepareEnabled === true,
    'X402_PREPARE_ENABLED must be true',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'signing_enabled',
    status.ticketSigningEnabled === true,
    'X402_SIGNING_ENABLED must be true',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'verification_enabled',
    status.ticketVerificationEnabled === true,
    'X402_VERIFY_ENABLED must be true',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'upstream_execution_enabled',
    status.upstreamExecutionEnabled === true,
    'X402_UPSTREAM_EXECUTION_ENABLED must be true',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'standalone_settlement_disabled',
    status.ticketSettlementEnabled === false,
    'X402_SETTLEMENT_ENABLED must stay false for Phase 5 upstream execution',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'live_execution_disabled',
    status.liveExecutionEnabled === false,
    'ALLOW_LIVE_EXECUTION must stay false',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'payment_sending_enabled',
    status.paymentSendingEnabled === true,
    'payment sending should be enabled only through upstream execution',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'wallet_configured',
    status.walletConfigured === true,
    'Render must have an isolated Base Sepolia wallet key and address',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'beta_access_configured',
    status.betaAccessConfigured === true,
    'Render must have BETA_EXECUTION_KEY configured',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'local_beta_key',
    betaKey.length >= 32,
    'local BETA_EXECUTION_KEY must contain at least 32 characters',
  )
  addPhase5Check(
    checks,
    blockedBy,
    'budget_cap',
    Number.isFinite(budget) && budget > 0 && budget <= MAX_PREPARE_BUDGET_USDC,
    `MAX_EXECUTION_BUDGET_USDC must be <= ${MAX_PREPARE_BUDGET_USDC}`,
  )
  addPhase5Check(
    checks,
    blockedBy,
    'operator_confirmation',
    env.X402_CONFIRM_UPSTREAM_EXECUTION === PHASE5_CONFIRMATION,
    `X402_CONFIRM_UPSTREAM_EXECUTION must equal ${PHASE5_CONFIRMATION}`,
  )

  return {
    ready: blockedBy.length === 0,
    mode: 'phase5-preflight',
    apiBase: baseUrl.toString().replace(/\/$/, ''),
    target: 'one audited Base Sepolia upstream x402 execution',
    checks,
    blockedBy,
    nextCommand:
      blockedBy.length === 0
        ? 'npm run x402:operator -- prepare && approve/consume the ticket, then sign-verify-execute <ticketId>'
        : 'fix blockedBy items, redeploy/restart backend, then rerun phase5-preflight',
    ts: Date.now(),
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
  allowSettlement = false,
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
  if (allowSettlement) {
    // Settlement is checked by the command-specific assertions below.
  } else if (allowSignature) {
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
    const body = await fetchExecutionStatus({ baseUrl, fetchImpl })
    if (
      body.paymentSendingEnabled !== false &&
      env.X402_CONFIRM_SETTLEMENT !== 'SETTLE_BASE_SEPOLIA' &&
      env.X402_CONFIRM_UPSTREAM_EXECUTION !== PHASE5_CONFIRMATION
    ) {
      throw new Error(
        'Safety assertion failed: settlement is enabled without explicit local confirmation',
      )
    }
    log(JSON.stringify(body, null, 2))
    return body
  }

  if (command === 'phase5-preflight') {
    const status = await fetchExecutionStatus({ baseUrl, fetchImpl })
    const report = buildPhase5Preflight({ baseUrl, status, env })
    log(JSON.stringify(report, null, 2))
    if (!report.ready) {
      throw new Error(`Phase 5 preflight blocked: ${report.blockedBy.join('; ')}`)
    }
    return report
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

  if (command === 'sign-verify') {
    const ticketId = argv[1] || env.X402_TICKET_ID
    if (!ticketId) {
      throw new Error(
        'sign-verify requires a ticket id argument or X402_TICKET_ID',
      )
    }

    const { body: signed } = await postJson({
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
    if (
      signed.mode !== 'sign-only' ||
      signed.paymentSigned !== true ||
      !signed.credential?.paymentPayload
    ) {
      throw new Error(`Unexpected sign response: ${JSON.stringify(signed)}`)
    }

    const { body: verified } = await postJson({
      baseUrl,
      path: '/execute/verify',
      betaKey,
      body: {
        ticketId,
        verifiedBy: env.X402_OPERATOR || 'operator-cli',
        paymentPayload: signed.credential.paymentPayload,
      },
      fetchImpl,
      label: 'Verify',
      allowSignature: true,
    })
    if (
      verified.mode !== 'verify-only' ||
      verified.verificationCompleted !== true ||
      verified.paymentSettled !== false ||
      verified.paymentSent !== false
    ) {
      throw new Error(
        `Unexpected verify response: ${JSON.stringify(verified)}`,
      )
    }

    const output = {
      success: verified.success,
      mode: 'sign-verify',
      ticket: verified.ticket,
      verification: verified.verification,
      paymentSigned: true,
      paymentVerified: verified.paymentVerified,
      paymentSettled: false,
      paymentSent: false,
      note: verified.note,
    }
    log(JSON.stringify(output, null, 2))
    return output
  }

  if (command === 'sign-verify-settle') {
    const ticketId = argv[1] || env.X402_TICKET_ID
    if (!ticketId) {
      throw new Error(
        'sign-verify-settle requires a ticket id argument or X402_TICKET_ID',
      )
    }
    if (env.X402_CONFIRM_SETTLEMENT !== 'SETTLE_BASE_SEPOLIA') {
      throw new Error(
        'X402_CONFIRM_SETTLEMENT must equal SETTLE_BASE_SEPOLIA',
      )
    }

    const { body: signed } = await postJson({
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
    if (
      signed.mode !== 'sign-only' ||
      signed.paymentSigned !== true ||
      !signed.credential?.paymentPayload
    ) {
      throw new Error(`Unexpected sign response: ${JSON.stringify(signed)}`)
    }

    const paymentPayload = signed.credential.paymentPayload
    const { body: verified } = await postJson({
      baseUrl,
      path: '/execute/verify',
      betaKey,
      body: {
        ticketId,
        verifiedBy: env.X402_OPERATOR || 'operator-cli',
        paymentPayload,
      },
      fetchImpl,
      label: 'Verify',
      allowSignature: true,
    })
    if (
      verified.mode !== 'verify-only' ||
      verified.paymentVerified !== true ||
      verified.paymentSettled !== false ||
      verified.paymentSent !== false
    ) {
      throw new Error(
        `Settlement blocked because verification was not valid: ${JSON.stringify(verified)}`,
      )
    }

    const { body: settled } = await postJson({
      baseUrl,
      path: '/execute/settle',
      betaKey,
      body: {
        ticketId,
        settledBy: env.X402_OPERATOR || 'operator-cli',
        settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
        paymentPayload,
      },
      fetchImpl,
      label: 'Settle',
      allowSettlement: true,
    })
    if (
      settled.mode !== 'settlement' ||
      settled.paymentSettled !== true ||
      settled.paymentSent !== true ||
      !settled.settlement?.transaction
    ) {
      throw new Error(`Settlement failed: ${JSON.stringify(settled)}`)
    }

    const output = {
      success: true,
      mode: 'sign-verify-settle',
      ticket: settled.ticket,
      transaction: settled.settlement.transaction,
      network: settled.settlement.network,
      paymentSigned: true,
      paymentVerified: true,
      paymentSettled: true,
      paymentSent: true,
    }
    log(JSON.stringify(output, null, 2))
    return output
  }

  if (command === 'sign-verify-execute') {
    const ticketId = argv[1] || env.X402_TICKET_ID
    if (!ticketId) {
      throw new Error(
        'sign-verify-execute requires a ticket id argument or X402_TICKET_ID',
      )
    }
    if (
      env.X402_CONFIRM_UPSTREAM_EXECUTION !== PHASE5_CONFIRMATION
    ) {
      throw new Error(
        `X402_CONFIRM_UPSTREAM_EXECUTION must equal ${PHASE5_CONFIRMATION}`,
      )
    }

    const { body: signed } = await postJson({
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
    if (
      signed.mode !== 'sign-only' ||
      signed.paymentSigned !== true ||
      !signed.credential?.paymentPayload
    ) {
      throw new Error(`Unexpected sign response: ${JSON.stringify(signed)}`)
    }

    const paymentPayload = signed.credential.paymentPayload
    const { body: verified } = await postJson({
      baseUrl,
      path: '/execute/verify',
      betaKey,
      body: {
        ticketId,
        verifiedBy: env.X402_OPERATOR || 'operator-cli',
        paymentPayload,
      },
      fetchImpl,
      label: 'Verify',
      allowSignature: true,
    })
    if (
      verified.mode !== 'verify-only' ||
      verified.paymentVerified !== true ||
      verified.paymentSettled !== false ||
      verified.paymentSent !== false
    ) {
      throw new Error(
        `Upstream execution blocked because verification was not valid: ${JSON.stringify(verified)}`,
      )
    }

    const { body: executed } = await postJson({
      baseUrl,
      path: '/execute/upstream',
      betaKey,
      body: {
        ticketId,
        executedBy: env.X402_OPERATOR || 'operator-cli',
        executionConfirmation: PHASE5_CONFIRMATION,
        paymentPayload,
      },
      fetchImpl,
      label: 'Upstream execution',
      allowSettlement: true,
    })
    if (
      executed.mode !== 'upstream-execution' ||
      executed.paymentSent !== true ||
      !executed.settlement?.transaction
    ) {
      throw new Error(
        `Upstream execution failed: ${JSON.stringify(executed)}`,
      )
    }

    const output = {
      success: true,
      mode: 'sign-verify-execute',
      ticket: executed.ticket,
      upstream: executed.upstream,
      transaction: executed.settlement.transaction,
      network: executed.settlement.network,
      paymentSigned: true,
      paymentVerified: true,
      paymentSent: true,
    }
    log(JSON.stringify(output, null, 2))
    return output
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
    'Unknown command. Use one of: status, phase5-preflight, prepare, approve <ticketId>, consume <ticketId>, sign <ticketId>, sign-verify <ticketId>, sign-verify-settle <ticketId>, sign-verify-execute <ticketId>',
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runOperatorCli()
}
