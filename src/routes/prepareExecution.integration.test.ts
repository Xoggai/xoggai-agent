import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { auditedX402Candidate } from '../config/auditedX402.js'
import {
  hashPaymentChallenge,
  type PreparedPaymentTicketInput,
} from '../services/paymentPrepareTickets.js'
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
          extra: { name: 'USDC', version: '2' },
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
    savePreparedPayment: false | 'throw'
    savedInputs: PreparedPaymentTicketInput[]
    betaAccessKeys: string
    loadUsage: {
      requestCount: number
      budgetUsdc: number
      amountUsdc: number
    }
  }> = {},
) {
  const app = new Hono()
  const paymentRequired =
    'paymentRequired' in overrides
      ? overrides.paymentRequired
      : paymentRequiredHeader()
  app.route(
    '/execute/prepare',
    createPrepareExecutionRoute({
      enabled: overrides.enabled ?? true,
      betaExecutionKey:
        'betaExecutionKey' in overrides
          ? overrides.betaExecutionKey
          : betaKey,
      betaAccessKeys: overrides.betaAccessKeys,
      maxBudgetUsdc: 0.005,
      dailyRequestLimit: 5,
      dailyBudgetUsdc: 0.01,
      policy: auditedX402Candidate,
      async fetchChallenge() {
        return {
          status: overrides.status ?? 402,
          paymentRequired,
        }
      },
      loadUsage: overrides.loadUsage
        ? async () => overrides.loadUsage!
        : undefined,
      savePreparedPayment:
        overrides.savePreparedPayment === false
          ? undefined
          : async (input) => {
              if (overrides.savePreparedPayment === 'throw') {
                throw new Error('payment_prepare_ticket_not_created')
              }
              overrides.savedInputs?.push(input)
              return {
                id: '11111111-1111-4111-8111-111111111111',
                status: 'PREPARED',
                challengeHash: hashPaymentChallenge(
                  input.paymentRequiredHeader,
                ),
                expiresAt: '2026-06-20T12:01:00.000Z',
              }
            },
      createRequestId: () => 'prepare-request-id',
    }),
  )
  return app
}

{
  const registryKey = 'registry-key-for-prepare-route-tests-12345'
  const savedInputs: PreparedPaymentTicketInput[] = []
  const { response, json } = await request(
    {
      betaExecutionKey: undefined,
      betaAccessKeys: JSON.stringify([
        {
          id: 'agent-alpha',
          label: 'Agent Alpha',
          key: registryKey,
          maxBudgetUsdc: 0.005,
          dailyRequestLimit: 5,
          dailyBudgetUsdc: 0.01,
        },
      ]),
      savedInputs,
    },
    registryKey,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(json.betaAccess, {
    id: 'agent-alpha',
    label: 'Agent Alpha',
  })
  assert.equal(savedInputs[0]?.betaKeyId, 'agent-alpha')
  assert.equal(savedInputs[0]?.betaClientLabel, 'Agent Alpha')
}

{
  const { response, json } = await request({
    loadUsage: {
      requestCount: 5,
      budgetUsdc: 0.005,
      amountUsdc: 0.002,
    },
  })
  assert.equal(response.status, 429)
  assert.equal(json.error, 'beta_daily_request_limit_exceeded')
}

{
  const { response, json } = await request({
    loadUsage: {
      requestCount: 1,
      budgetUsdc: 0.008,
      amountUsdc: 0.002,
    },
  })
  assert.equal(response.status, 429)
  assert.equal(json.error, 'beta_daily_budget_exceeded')
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
  const savedInputs: PreparedPaymentTicketInput[] = []
  const { response, json } = await request({ savedInputs })
  assert.equal(response.status, 200)
  assert.equal(json.success, true)
  assert.equal(json.mode, 'prepare-only')
  assert.equal(json.paymentPrepared, true)
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
  assert.deepEqual(json.ticket, {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'PREPARED',
    challengeHash: hashPaymentChallenge(paymentRequiredHeader()),
    expiresAt: '2026-06-20T12:01:00.000Z',
  })
  assert.equal(savedInputs.length, 1)
  assert.equal(savedInputs[0]?.requestId, 'prepare-request-id')
  assert.equal(savedInputs[0]?.budgetUsdc, 0.005)
  assert.equal(savedInputs[0]?.preview.resourceUrl, auditedX402Candidate.resourceUrl)
}

{
  const { response, json } = await request({ savePreparedPayment: 'throw' })
  assert.equal(response.status, 502)
  assert.equal(json.error, 'payment_prepare_ticket_not_created')
  assert.equal(json.paymentSigned, false)
  assert.equal(json.paymentSent, false)
}

console.log('prepare execution route integration tests passed')
