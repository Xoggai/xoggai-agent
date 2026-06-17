import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { auditedX402Candidate } from '../config/auditedX402.js'
import { createPrepareExecutionRoute } from './prepareExecutionRoute.js'

const betaKey = 'beta-key-for-prepare-route-tests'

function paymentRequiredHeader(amount = '2000') {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      resource: { url: auditedX402Candidate.resourceUrl },
      accepts: [
        {
          scheme: 'exact',
          network: auditedX402Candidate.network,
          asset: auditedX402Candidate.asset,
          amount,
          payTo: auditedX402Candidate.recipient,
          maxTimeoutSeconds: auditedX402Candidate.maxTimeoutSeconds,
        },
      ],
    }),
  ).toString('base64')
}

function createApp(
  overrides: Partial<{
    enabled: boolean
    betaExecutionKey: string | undefined
    status: number
    paymentRequired: string | undefined
  }> = {},
) {
  const app = new Hono()
  app.route(
    '/execute/prepare',
    createPrepareExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      policy: auditedX402Candidate,
      async fetchChallenge() {
        return {
          status: overrides.status ?? 402,
          paymentRequired:
            'paymentRequired' in overrides
              ? overrides.paymentRequired
              : paymentRequiredHeader(),
        }
      },
      createRequestId: () => 'prepare-request-id',
    }),
  )
  return app
}

async function request(
  overrides: Parameters<typeof createApp>[0] = {},
  key = betaKey,
  body: unknown = { budget: 0.005 },
) {
  const response = await createApp(overrides).request('/execute/prepare', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-beta-key': key,
    },
    body: JSON.stringify(body),
  })
  return { response, json: (await response.json()) as Record<string, unknown> }
}

{
  const { response, json } = await request({}, betaKey, {})
  assert.equal(response.status, 400)
  assert.equal(json.error, 'invalid_request')
}

{
  const { response, json } = await request({ enabled: false })
  assert.equal(response.status, 503)
  assert.equal(json.error, 'payment_prepare_disabled')
}

{
  const { response, json } = await request({}, 'wrong-key')
  assert.equal(response.status, 401)
  assert.equal(json.error, 'invalid_beta_access')
}

{
  const { response, json } = await request({ status: 200 })
  assert.equal(response.status, 502)
  assert.equal(json.error, 'upstream_payment_challenge_missing')
}

{
  const { response, json } = await request({ paymentRequired: undefined })
  assert.equal(response.status, 502)
  assert.equal(json.error, 'upstream_payment_challenge_missing')
}

{
  const { response, json } = await request({})
  assert.equal(response.status, 200)
  assert.equal(json.success, true)
  assert.equal(json.mode, 'prepare-only')
  assert.equal(json.paymentPrepared, true)
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

console.log('prepare execution route integration tests passed')
