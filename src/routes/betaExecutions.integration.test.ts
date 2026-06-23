import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { createBetaExecutionsRoute } from './betaExecutions.js'

const app = new Hono()
app.route(
  '/api/beta/executions',
  createBetaExecutionsRoute({
    resolveAccess(candidate) {
      if (candidate !== 'valid-beta-key') return undefined
      return {
        id: 'agent-alpha',
        label: 'Agent Alpha',
        enabled: true,
        maxBudgetUsdc: 0.005,
        dailyRequestLimit: 5,
        dailyBudgetUsdc: 0.02,
      }
    },
    async getUsage({ betaKeyId }) {
      assert.equal(betaKeyId, 'agent-alpha')
      return {
        requestCount: 2,
        budgetUsdc: 0.008,
        amountUsdc: 0.004,
      }
    },
    async listExecutions({ betaKeyId, limit }) {
      assert.equal(betaKeyId, 'agent-alpha')
      assert.equal(limit, 10)
      return [{ id: 'ticket-1', status: 'EXECUTED' }]
    },
    executionEnabled: {
      prepare: true,
      signing: false,
      verification: false,
      upstream: false,
    },
  }),
)

{
  const response = await app.request('/api/beta/executions')
  const json = await response.json()
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}

{
  const response = await app.request('/api/beta/executions?limit=10', {
    headers: { 'x-beta-key': 'valid-beta-key' },
  })
  const json = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(json.betaAccess.id, 'agent-alpha')
  assert.equal(json.usage.remainingRequests, 3)
  assert.equal(json.usage.remainingBudgetUsdc, 0.012)
  assert.equal(json.executions[0].status, 'EXECUTED')
}

console.log('beta executions route integration tests passed')
