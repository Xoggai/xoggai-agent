import assert from 'node:assert/strict'
import { runPhase14LaunchQa } from './phase14-launch-qa.mjs'

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function html() {
  return new Response('<!doctype html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function text() {
  return new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function png() {
  return new Response(new Uint8Array([137, 80, 78, 71]), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })
}

const calls = []
const result = await runPhase14LaunchQa({
  env: {
    XOGGAI_API_BASE: 'https://api.example.test',
    XOGGAI_WEBSITE_URL: 'https://www.example.test',
  },
  log: () => {},
  async fetchImpl(url, options = {}) {
    calls.push({ url, headers: options.headers || {} })
    if (url.endsWith('/health')) {
      return json({
        status: 'ok',
        service: 'xoggai-backend',
        version: 'test',
        environment: 'production',
      })
    }
    if (url.endsWith('/ready')) {
      return json({
        ready: true,
        dependencies: {
          database: { status: 'ok', latencyMs: 1 },
          cache: { status: 'ok', latencyMs: 1 },
        },
      })
    }
    if (url.endsWith('/api/info')) {
      return json({
        liveExecutionEnabled: false,
        network: 'base-sepolia',
      })
    }
    if (url.endsWith('/api/execution-status')) {
      return json({
        safetyMode: 'testnet-upstream-execution',
        network: 'base-sepolia',
        liveExecutionEnabled: false,
        upstreamExecutionEnabled: true,
        paymentSigningEnabled: true,
        paymentVerificationEnabled: true,
        paymentSendingEnabled: true,
        operationsKillSwitchActive: false,
        publicBetaEnabled: true,
        publicBetaAdminConfigured: true,
        walletConfigured: true,
        maxExecutionBudgetUsdc: 0.005,
        guardrails: {
          testnetExecutionRequiresManagedAllowlist: true,
          betaRequestsRequireIdempotencyKeys: true,
          betaRequestsExpireBeforeExecution: true,
        },
      })
    }
    if (url.includes('/intent?')) {
      return json({
        success: true,
        dryRun: true,
        endpoint: { name: 'Token Price Oracle' },
      })
    }
    if (url.includes('/search?')) {
      return json({ results: [] })
    }
    if (url.endsWith('/openapi.json')) {
      return json({
        openapi: '3.1.0',
        paths: {
          '/intent': {},
          '/api/execution-status': {},
        },
      })
    }
    if (url.endsWith('.png')) return png()
    if (url.endsWith('.md') || url.endsWith('.txt') || url.endsWith('.js')) {
      return text()
    }
    return html()
  },
})

assert.equal(result.success, true)
assert.equal(result.phase, 14)
assert.equal(result.backendResult.safetyMode, 'testnet-upstream-execution')
assert.equal(result.backendResult.wallet.status, 'status-only')
assert.equal(result.frontend.agentFiles.length, 3)
assert.equal(result.adminOps.status, 'skipped')
assert.equal(calls.some((call) => call.url.endsWith('/api/admin/ops')), false)
console.log('phase 14 launch QA tests passed')
