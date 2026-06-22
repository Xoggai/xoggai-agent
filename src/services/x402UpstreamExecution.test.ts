import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { PaymentPayload } from '@x402/core/types'
import type { UpstreamExecutionPaymentTicket } from './paymentPrepareTickets.js'
import {
  X402UpstreamExecutionError,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
  executeVerifiedX402Resource,
} from './x402UpstreamExecution.js'

const ticket: UpstreamExecutionPaymentTicket = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'VERIFIED',
  challengeHash:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  resourceUrl: 'https://example.test/paid',
  network: 'eip155:84532',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  assetName: 'USDC',
  assetVersion: '2',
  recipient: '0xd275612Bf0BB35638432c4D95eAA8D5d22346Ca6',
  amountAtomic: '2000',
  amountUsdc: 0.002,
  maxTimeoutSeconds: 60,
  signerAddress: '0x0000000000000000000000000000000000000001',
  signatureHash: createHash('sha256').update('0x1234').digest('hex'),
  signedAt: '2026-06-20T12:00:30.000Z',
  expiresAt: '2026-06-20T12:01:00.000Z',
}

const paymentPayload = {
  x402Version: 2,
  resource: { url: ticket.resourceUrl },
  accepted: {
    scheme: 'exact',
    network: ticket.network,
    asset: ticket.asset,
    amount: ticket.amountAtomic,
    payTo: ticket.recipient,
    maxTimeoutSeconds: ticket.maxTimeoutSeconds,
    extra: { name: ticket.assetName, version: ticket.assetVersion },
  },
  payload: {
    signature: '0x1234',
    authorization: {
      from: ticket.signerAddress,
      to: ticket.recipient,
      value: ticket.amountAtomic,
    },
  },
  extensions: {},
} as PaymentPayload

const policy = {
  method: 'GET' as const,
  resourceUrl: ticket.resourceUrl,
  network: ticket.network,
  maxAmountAtomic: 5_000n,
}

{
  const header = encodePaymentSignatureHeader(paymentPayload)
  assert.equal(
    JSON.parse(Buffer.from(header, 'base64').toString('utf8')).x402Version,
    2,
  )
}
{
  const response = { success: true, transaction: `0x${'b'.repeat(64)}` }
  const header = Buffer.from(JSON.stringify(response), 'utf8').toString(
    'base64',
  )
  assert.deepEqual(decodePaymentResponseHeader(header), response)
}
{
  const paymentResponse = Buffer.from(
    JSON.stringify({
      success: true,
      transaction: `0x${'c'.repeat(64)}`,
      network: ticket.network,
    }),
    'utf8',
  ).toString('base64')
  const result = await executeVerifiedX402Resource({
    ticket,
    paymentPayload,
    policy,
    maxBudgetUsdc: 0.005,
    executionConfirmation: 'EXECUTE_X402_BASE_SEPOLIA',
    fetchImpl: async (_url, init) => {
      assert.equal(init?.method, 'GET')
      assert.equal(
        (init?.headers as Record<string, string>)['PAYMENT-SIGNATURE'],
        encodePaymentSignatureHeader(paymentPayload),
      )
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'PAYMENT-RESPONSE': paymentResponse },
      })
    },
  })
  assert.equal(result.success, true)
  assert.equal(result.statusCode, 200)
  assert.equal(result.settlement?.transaction, `0x${'c'.repeat(64)}`)
}
{
  await assert.rejects(
    () =>
      executeVerifiedX402Resource({
        ticket,
        paymentPayload,
        policy,
        maxBudgetUsdc: 0.005,
        executionConfirmation: '',
        fetchImpl: async () => new Response('{}'),
      }),
    (error) =>
      error instanceof X402UpstreamExecutionError &&
      error.code === 'upstream_execution_confirmation_required',
  )
}
{
  await assert.rejects(
    () =>
      executeVerifiedX402Resource({
        ticket: { ...ticket, amountUsdc: 0.006 },
        paymentPayload,
        policy,
        maxBudgetUsdc: 0.005,
        executionConfirmation: 'EXECUTE_X402_BASE_SEPOLIA',
        fetchImpl: async () => new Response('{}'),
      }),
    (error) =>
      error instanceof X402UpstreamExecutionError &&
      error.code === 'upstream_budget_exceeded',
  )
}
{
  await assert.rejects(
    () =>
      executeVerifiedX402Resource({
        ticket,
        paymentPayload,
        policy,
        maxBudgetUsdc: 0.005,
        executionConfirmation: 'EXECUTE_X402_BASE_SEPOLIA',
        fetchImpl: async () => new Response('{"ok":true}', { status: 200 }),
      }),
    (error) =>
      error instanceof X402UpstreamExecutionError &&
      error.code === 'upstream_payment_response_missing',
  )
}

console.log('x402 upstream execution tests passed')
