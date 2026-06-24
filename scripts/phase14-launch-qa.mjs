import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

function read(path) {
  return readFileSync(path, 'utf8')
}

function assertIncludes(file, expected) {
  assert.ok(
    read(file).includes(expected),
    `${file} must include ${JSON.stringify(expected)}`,
  )
}

function assertNotIncludes(file, unexpected) {
  assert.ok(
    !read(file).includes(unexpected),
    `${file} must not include ${JSON.stringify(unexpected)}`,
  )
}

async function request(fetchImpl, url, expectedContentType, options = {}) {
  const attempts = options.attempts || 3
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        redirect: options.redirect || 'follow',
        signal: AbortSignal.timeout(options.timeoutMs || 45_000),
        headers: {
          'user-agent': 'xoggai-phase14-launch-qa/1.0',
          ...(options.headers || {}),
        },
      })
      assert.equal(response.ok, true, `${url} returned ${response.status}`)
      const contentType = response.headers.get('content-type') || ''
      assert.match(contentType, expectedContentType, `${url} content type`)
      return response
    } catch (error) {
      lastError = error
      if (attempt === attempts) break
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    }
  }
  throw lastError
}

function endpoint(base, path) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function isEvmAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value || '')
}

async function maybeCheckWalletBalance({ env, status }) {
  assert.equal(status.walletConfigured, true, 'testnet wallet must be configured')

  const walletAddress =
    env.PHASE14_WALLET_ADDRESS || env.X402_WALLET_ADDRESS || ''
  const rpcUrl =
    env.PHASE14_BASE_SEPOLIA_RPC_URL ||
    env.BASE_SEPOLIA_RPC_URL ||
    env.X402_BASE_SEPOLIA_RPC_URL ||
    ''

  if (!walletAddress || !rpcUrl) {
    return {
      status: 'status-only',
      walletConfigured: true,
      reason:
        'set PHASE14_WALLET_ADDRESS and PHASE14_BASE_SEPOLIA_RPC_URL for direct balance verification',
    }
  }

  assert.ok(isEvmAddress(walletAddress), 'wallet address must be EVM format')
  const { createPublicClient, formatEther, http } = await import('viem')
  const { baseSepolia } = await import('viem/chains')
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  })
  const balanceWei = await client.getBalance({ address: walletAddress })
  const minimumEth = Number(env.PHASE14_MIN_WALLET_ETH || '0.00001')
  const balanceEth = Number(formatEther(balanceWei))
  assert.ok(
    balanceEth >= minimumEth,
    `wallet balance ${balanceEth} ETH below minimum ${minimumEth} ETH`,
  )
  return {
    status: 'verified',
    walletConfigured: true,
    address: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    balanceEth,
    minimumEth,
  }
}

function checkLocalLaunchArtifacts() {
  const requiredFiles = [
    'README.md',
    'SECURITY.md',
    'CHANGELOG.md',
    'package.json',
    'netlify.toml',
    'render.yaml',
    'Dockerfile',
    'frontend/index.html',
    'frontend/docs.html',
    'frontend/beta/index.html',
    'frontend/admin/index.html',
    'frontend/openapi.json',
    'frontend/skill.md',
    'frontend/llms.txt',
    'frontend/examples/xoggai-sdk.js',
    'frontend/examples/curl.md',
    'docs/LAUNCH_CHECKLIST.md',
    'docs/BACKUP_RECOVERY.md',
    'docs/INCIDENT_RESPONSE.md',
    'docs/OPERATOR_RUNBOOK.md',
    'docs/PHASE13_TESTNET_RELIABILITY.md',
    'scripts/database-backup.mjs',
    'scripts/phase8-smoke.mjs',
  ]

  for (const file of requiredFiles) {
    assert.ok(existsSync(file), `${file} must exist`)
  }

  JSON.parse(read('frontend/openapi.json'))

  assertIncludes('.gitignore', 'backups/')
  assertIncludes('docs/BACKUP_RECOVERY.md', 'pg_restore')
  assertIncludes('docs/BACKUP_RECOVERY.md', 'Never test a restore against production')
  assertIncludes('docs/INCIDENT_RESPONSE.md', 'OPERATIONS_KILL_SWITCH=true')
  assertIncludes('docs/INCIDENT_RESPONSE.md', 'PUBLIC_BETA_ENABLED=false')
  assertIncludes('docs/INCIDENT_RESPONSE.md', 'Never retry an unknown payment')
  assertIncludes('docs/LAUNCH_CHECKLIST.md', 'public testnet beta')
  assertIncludes('docs/OPERATOR_RUNBOOK.md', 'testnet-upstream-execution')
  assertIncludes('frontend/docs.html', 'Agent snippet')
  assertIncludes('frontend/docs.html', 'OpenAPI')
  assertIncludes('frontend/docs.html', 'curl')
  assertIncludes('frontend/index.html', 'Developer kit')
  assertIncludes('frontend/beta/index.html', 'Idempotency')
  assertIncludes('frontend/beta/index.html', 'Request expiry')

  for (const file of [
    'frontend/index.html',
    'frontend/docs.html',
    'frontend/beta/index.html',
  ]) {
    assertIncludes(file, 'name="viewport"')
    assertIncludes(file, '@media(max-width')
    assertNotIncludes(file, 'X402_WALLET_PRIVATE_KEY')
    assertNotIncludes(file, 'PUBLIC_BETA_ADMIN_KEY')
    assertNotIncludes(file, 'BETA_EXECUTION_KEY')
  }
  assertIncludes('frontend/admin/index.html', 'name="viewport"')
  assertIncludes('frontend/admin/index.html', '@media(max-width')
  assertIncludes('frontend/admin/index.html', 'PUBLIC_BETA_ADMIN_KEY')
  assertNotIncludes('frontend/admin/index.html', 'X402_WALLET_PRIVATE_KEY')
  assertNotIncludes('frontend/admin/index.html', 'BETA_EXECUTION_KEY')

  return {
    artifacts: requiredFiles.length,
    openapi: 'valid-json',
    backupRestore: 'documented',
    incidentDrill: 'documented',
    mobileUiPass: 'responsive-breakpoints-present',
    onboardingPass: 'docs-and-developer-kit-present',
  }
}

async function checkBackend({ backend, fetchImpl, env }) {
  const health = await (
    await request(fetchImpl, endpoint(backend, '/health'), /json/)
  ).json()
  assert.equal(health.status, 'ok')
  assert.equal(health.service, 'xoggai-backend')

  const ready = await (
    await request(fetchImpl, endpoint(backend, '/ready'), /json/)
  ).json()
  assert.equal(ready.ready, true)
  assert.equal(ready.dependencies.database.status, 'ok')
  assert.equal(ready.dependencies.cache.status, 'ok')

  const info = await (
    await request(fetchImpl, endpoint(backend, '/api/info'), /json/)
  ).json()
  assert.equal(info.liveExecutionEnabled, false)
  assert.equal(info.network, 'base-sepolia')

  const status = await (
    await request(fetchImpl, endpoint(backend, '/api/execution-status'), /json/)
  ).json()
  assert.equal(status.safetyMode, 'testnet-upstream-execution')
  assert.equal(status.network, 'base-sepolia')
  assert.equal(status.liveExecutionEnabled, false)
  assert.equal(status.upstreamExecutionEnabled, true)
  assert.equal(status.paymentSigningEnabled, true)
  assert.equal(status.paymentVerificationEnabled, true)
  assert.equal(status.paymentSendingEnabled, true)
  assert.equal(status.operationsKillSwitchActive, false)
  assert.equal(status.publicBetaEnabled, true)
  assert.equal(status.publicBetaAdminConfigured, true)
  assert.equal(status.walletConfigured, true)
  assert.ok(status.maxExecutionBudgetUsdc <= 0.005)
  assert.equal(status.guardrails?.testnetExecutionRequiresManagedAllowlist, true)
  assert.equal(status.guardrails?.betaRequestsRequireIdempotencyKeys, true)
  assert.equal(status.guardrails?.betaRequestsExpireBeforeExecution, true)

  const intent = await (
    await request(
      fetchImpl,
      endpoint(
        backend,
        '/intent?q=what%20is%20the%20ETH%20price&budget=0.002&dry=true',
      ),
      /json/,
    )
  ).json()
  assert.equal(intent.success, true)
  assert.equal(intent.dryRun ?? intent.dry, true)

  const search = await (
    await request(
      fetchImpl,
      endpoint(backend, '/search?q=crypto%20price&limit=5&dry=true'),
      /json/,
    )
  ).json()
  assert.ok(Array.isArray(search.results), 'search results must be an array')

  const wallet = await maybeCheckWalletBalance({ env, status })

  return {
    version: health.version,
    environment: health.environment,
    dependencies: ready.dependencies,
    safetyMode: status.safetyMode,
    maxExecutionBudgetUsdc: status.maxExecutionBudgetUsdc,
    wallet,
  }
}

async function checkAdminOps({ backend, fetchImpl, env }) {
  if (!env.PUBLIC_BETA_ADMIN_KEY) {
    return {
      status: 'skipped',
      reason: 'PUBLIC_BETA_ADMIN_KEY not provided locally',
    }
  }
  const ops = await (
    await request(fetchImpl, endpoint(backend, '/api/admin/ops'), /json/, {
      headers: { 'x-admin-key': env.PUBLIC_BETA_ADMIN_KEY },
    })
  ).json()
  assert.equal(ops.success, true)
  assert.equal(ops.readiness.ready, true)
  assert.equal(ops.operations.killSwitchActive, false)
  assert.equal(ops.operations.publicBetaEnabled, true)
  assert.equal(ops.operations.paymentSendingEnabled, true)
  assert.equal(ops.reliability.status, 'healthy')
  return {
    status: 'verified',
    reliability: ops.reliability.status,
    pendingRequests: ops.beta.pendingRequests,
    allowlistedEndpoints: ops.reliability.allowlistedEndpoints,
  }
}

async function checkFrontend({ website, fetchImpl }) {
  const paths = [
    ['/', /html/],
    ['/docs', /html/],
    ['/docs.html', /html/],
    ['/connect-agent/', /html/],
    ['/beta/', /html/],
    ['/skill.md', /text|markdown|plain/],
    ['/llms.txt', /text|plain/],
    ['/openapi.json', /json/],
    ['/examples/xoggai-sdk.js', /javascript|text|plain/],
    ['/examples/curl.md', /text|markdown|plain/],
    ['/assets/xoggai-preview-v2.png', /image\/png/],
    ['/favicon.png', /image\/png/],
  ]
  for (const [path, contentType] of paths) {
    const response = await request(fetchImpl, endpoint(website, path), contentType)
    await response.arrayBuffer()
  }

  const openapi = await (
    await request(fetchImpl, endpoint(website, '/openapi.json'), /json/)
  ).json()
  assert.match(openapi.openapi, /^3\./)
  assert.ok(openapi.paths?.['/intent'], 'openapi must describe /intent')
  assert.ok(openapi.paths?.['/api/execution-status'], 'openapi must describe execution status')

  return {
    pagesChecked: paths.length,
    openapi: openapi.openapi,
    agentFiles: ['skill.md', 'llms.txt', 'openapi.json'],
  }
}

export async function runPhase14LaunchQa({
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const backend = (
    env.XOGGAI_API_BASE || 'https://xoggai-backend.onrender.com'
  ).replace(/\/$/, '')
  const website = (
    env.XOGGAI_WEBSITE_URL || 'https://xoggai-agent.com'
  ).replace(/\/$/, '')

  const local = checkLocalLaunchArtifacts()
  const backendResult = await checkBackend({ backend, fetchImpl, env })
  const frontend = await checkFrontend({ website, fetchImpl })
  const adminOps = await checkAdminOps({ backend, fetchImpl, env })

  const result = {
    success: true,
    phase: 14,
    mode: 'testnet-launch-qa',
    backend,
    website,
    local,
    backendResult,
    frontend,
    adminOps,
    launchStatus: 'production-grade testnet beta ready',
  }
  log(JSON.stringify(result, null, 2))
  return result
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runPhase14LaunchQa()
}
