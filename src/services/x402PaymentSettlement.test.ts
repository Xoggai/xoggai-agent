import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import type {
  SettlementPaymentTicket,
  SignablePaymentTicket,
} from './paymentPrepareTickets.js'
import {
  PaymentSettlementError,
  assertSettlementRequest,
  settleVerifiedPaymentCredential,
} from './x402PaymentSettlement.js'
import { createSignedPaymentCredential } from './x402PaymentSigning.js'

const privateKey =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const account = privateKeyToAccount(privateKey)
const consumedTicket: SignablePaymentTicket = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'CONSUMED',
  challengeHash:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  resourceUrl: 'https://example.test/paid',
  network: 'eip155:84532',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  assetName: 'USDC',
  assetVersion: '2',
  recipient: '0xd275612Bf0BB35638432c4D95eAA8D5d22346Ca6',
  amountAtomic: '2000',
  maxTimeoutSeconds: 60,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}
const credential = await createSignedPaymentCredential({
  ticket: consumedTicket,
  privateKey,
  expectedAddress: account.address,
})
const ticket: SettlementPaymentTicket = {
  ...consumedTicket,
  status: 'VERIFIED',
  amountUsdc: 0.002,
  signerAddress: account.address,
  signatureHash: credential.signatureHash,
  signedAt: new Date().toISOString(),
}

assert.equal(
  assertSettlementRequest({
    ticket,
    paymentPayload: credential.paymentPayload,
    facilitatorUrl: 'https://x402.org/facilitator',
    maxBudgetUsdc: 0.005,
    settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
  }),
  'https://x402.org/facilitator',
)

let settleCalls = 0
const result = await settleVerifiedPaymentCredential({
  ticket,
  paymentPayload: credential.paymentPayload,
  facilitatorUrl: 'https://x402.org/facilitator',
  maxBudgetUsdc: 0.005,
  settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
  facilitatorClient: {
    async settle(payload, requirements) {
      settleCalls += 1
      assert.equal(payload.x402Version, 2)
      assert.equal(requirements.amount, '2000')
      return {
        success: true,
        payer: account.address,
        transaction: `0x${'a'.repeat(64)}`,
        network: 'eip155:84532',
      }
    },
  },
})
assert.equal(settleCalls, 1)
assert.equal(result.response.success, true)
assert.match(result.resultHash, /^[0-9a-f]{64}$/)

assert.throws(
  () =>
    assertSettlementRequest({
      ticket,
      paymentPayload: credential.paymentPayload,
      facilitatorUrl: 'https://x402.org/facilitator',
      maxBudgetUsdc: 0.005,
      settlementConfirmation: '',
    }),
  (error) =>
    error instanceof PaymentSettlementError &&
    error.code === 'settlement_confirmation_required',
)

assert.throws(
  () =>
    assertSettlementRequest({
      ticket: { ...ticket, amountUsdc: 0.006 },
      paymentPayload: credential.paymentPayload,
      facilitatorUrl: 'https://x402.org/facilitator',
      maxBudgetUsdc: 0.005,
      settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
    }),
  (error) =>
    error instanceof PaymentSettlementError &&
    error.code === 'settlement_budget_exceeded',
)

assert.throws(
  () =>
    assertSettlementRequest({
      ticket,
      paymentPayload: credential.paymentPayload,
      facilitatorUrl: 'https://example.com/facilitator',
      maxBudgetUsdc: 0.005,
      settlementConfirmation: 'SETTLE_BASE_SEPOLIA',
    }),
  (error) =>
    error instanceof PaymentSettlementError &&
    error.code === 'settlement_facilitator_not_allowed',
)

console.log('x402 payment settlement tests passed')
