import assert from 'node:assert/strict'
import { runPhase8Smoke } from './phase8-smoke.mjs'

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

const result = await runPhase8Smoke({
  env: {
    XOGGAI_API_BASE: 'https://api.example.test',
    XOGGAI_WEBSITE_URL: 'https://www.example.test',
  },
  log: () => {},
  async fetchImpl(url) {
    if (url.endsWith('/health')) {
      return json({
        status: 'ok',
        service: 'xoggai-backend',
        version: 'test',
        environment: 'test',
      })
    }
    if (url.endsWith('/ready')) {
      return json({
        ready: true,
        dependencies: {
          database: { status: 'ok' },
          cache: { status: 'ok' },
        },
      })
    }
    if (url.endsWith('/api/execution-status')) {
      return json({
        safetyMode: 'dry-run-preview',
        liveExecutionEnabled: false,
        paymentSendingEnabled: false,
        operationsKillSwitchActive: false,
        publicBetaEnabled: true,
        publicBetaAdminConfigured: true,
      })
    }
    if (url.endsWith('/openapi.json')) {
      return json({ openapi: '3.1.0' })
    }
    return html()
  },
})

assert.equal(result.success, true)
assert.equal(result.paymentSendingEnabled, false)
console.log('phase 8 production smoke tests passed')
