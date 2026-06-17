import assert from 'node:assert/strict'
import { Hono } from 'hono'
import {
  createExecuteRoute,
  type ExecuteRouteDependencies,
} from './executeRoute.js'

const endpointId = '4edb9fd7-d74d-4c53-a116-592a364eb8f3'
const missingEndpointId = 'c4dfd188-342c-4f12-b167-86b930047a1b'
const betaKey = 'beta-key-for-route-integration-tests'
const endpoint = {
  id: endpointId,
  name: 'Test Endpoint',
  url: 'example.test/x402',
  priceUsdc: 0.001,
  isActive: true,
}

type Overrides = Partial<ExecuteRouteDependencies['config']> & {
  endpointFound?: boolean
}

function createApp(overrides: Overrides = {}) {
  const app = new Hono()
  app.route(
    '/execute',
    createExecuteRoute({
      config: {
        simulationEnabled: overrides.simulationEnabled ?? true,
        liveExecutionEnabled: overrides.liveExecutionEnabled ?? false,
        betaExecutionKey:
          'betaExecutionKey' in overrides ? overrides.betaExecutionKey : betaKey,
        maxBudgetUsdc: overrides.maxBudgetUsdc ?? 0.01,
        endpointAllowlist: overrides.endpointAllowlist ?? new Set([endpointId]),
      },
      async findEndpoint(id) {
        return overrides.endpointFound === false || id === missingEndpointId
          ? undefined
          : endpoint
      },
      createRequestId: () => 'request-test-id',
      logPolicy: () => undefined,
    }),
  )
  return app
}

async function request(
  overrides: Overrides,
  body: unknown,
  key: string | undefined = betaKey,
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key) headers['x-beta-key'] = key

  const response = await createApp(overrides).request('/execute', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return { response, json: (await response.json()) as Record<string, unknown> }
}

const validBody = {
  intent: 'get the ETH price',
  endpointId,
  budget: 0.005,
  mode: 'simulation',
}

{
  const { response, json } = await request({}, { endpointId })
  assert.equal(response.status, 400)
  assert.equal(json.error, 'invalid_request')
  assert.equal(json.paymentSent, false)
}

{
  const { response, json } = await request({ simulationEnabled: false }, validBody)
  assert.equal(response.status, 503)
  assert.equal(json.error, 'execution_simulation_disabled')
}

{
  const { response, json } = await request({ betaExecutionKey: undefined }, validBody)
  assert.equal(response.status, 503)
  assert.equal(json.error, 'beta_access_not_configured')
}

{
  const { response, json } = await request({}, validBody, 'wrong-beta-key')
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}

{
  const { response, json } = await request(
    {},
    { ...validBody, endpointId: missingEndpointId },
  )
  assert.equal(response.status, 404)
  assert.equal(json.error, 'unknown_endpoint')
}

{
  const { response, json } = await request(
    { endpointAllowlist: new Set() },
    validBody,
  )
  assert.equal(response.status, 403)
  assert.deepEqual(json.blockedBy, ['endpoint_not_allowlisted'])
}

{
  const { response, json } = await request(
    { maxBudgetUsdc: 0.002 },
    { ...validBody, budget: 0.003 },
  )
  assert.equal(response.status, 403)
  assert.deepEqual(json.blockedBy, ['budget_above_limit'])
}

{
  const { response, json } = await request({}, { ...validBody, budget: 0.0005 })
  assert.equal(response.status, 403)
  assert.deepEqual(json.blockedBy, ['endpoint_price_above_budget'])
}

{
  const { response, json } = await request({}, validBody)
  assert.equal(response.status, 200)
  assert.equal(json.success, true)
  assert.equal(json.simulationPassed, true)
  assert.equal(json.liveExecutionEnabled, false)
  assert.equal(json.paymentSent, false)
}

console.log('execute route integration tests passed')
