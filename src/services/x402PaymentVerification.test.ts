import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import type {
  SignablePaymentTicket,
  VerifiablePaymentTicket,
} from './paymentPrepareTickets.js'
import { createSignedPaymentCredential } from './x402PaymentSigning.js'
import {
  PaymentVerificationError,
  verifySignedPaymentCredential,
} from './x402PaymentVerification.js'

const privateKey =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const account = privateKeyToAccount(privateKey)
const consumedTicket: SignablePaymentTicket = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'CONSUMED',
  challengeHash:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  resourceUrl:
    'https://sandbox.node4all.com/v1/x402-test?host=sandbox.node4all.com',
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
const signedTicket: VerifiablePaymentTicket = {
  ...consumedTicket,
  status: 'SIGNED',
  signerAddress: account.address,
  signatureHash: credential.signatureHash,
  signedAt: new Date().toISOString(),
}

let verifyCalls = 0
const result = await verifySignedPaymentCredential({
  ticket: signedTicket,
  paymentPayload: credential.paymentPayload,
  facilitatorUrl: 'https://x402.org/facilitator',
  facilitatorClient: {
    async verify(payload, requirements) {
      verifyCalls += 1
      assert.equal(payload.x402Version, 2)
      assert.equal(requirements.network, 'eip155:84532')
      return { isValid: true, payer: account.address }
    },
  },
})
assert.equal(verifyCalls, 1)
assert.equal(result.response.isValid, true)
assert.equal(result.response.payer, account.address)
assert.match(result.resultHash, /^[0-9a-f]{64}$/)

await assert.rejects(
  verifySignedPaymentCredential({
    ticket: signedTicket,
    paymentPayload: {
      ...credential.paymentPayload,
      accepted: {
        ...credential.paymentPayload.accepted,
        amount: '3000',
      },
    },
    facilitatorUrl: 'https://x402.org/facilitator',
    facilitatorClient: { verify: async () => ({ isValid: true }) },
  }),
  (error) =>
    error instanceof PaymentVerificationError &&
    error.code === 'verification_payload_mismatch',
)

await assert.rejects(
  verifySignedPaymentCredential({
    ticket: { ...signedTicket, signatureHash: 'f'.repeat(64) },
    paymentPayload: credential.paymentPayload,
    facilitatorUrl: 'https://x402.org/facilitator',
    facilitatorClient: { verify: async () => ({ isValid: true }) },
  }),
  (error) =>
    error instanceof PaymentVerificationError &&
    error.code === 'verification_signature_mismatch',
)

await assert.rejects(
  verifySignedPaymentCredential({
    ticket: signedTicket,
    paymentPayload: credential.paymentPayload,
    facilitatorUrl: 'https://example.com/facilitator',
    facilitatorClient: { verify: async () => ({ isValid: true }) },
  }),
  (error) =>
    error instanceof PaymentVerificationError &&
    error.code === 'verification_facilitator_not_allowed',
)

console.log('x402 payment verification tests passed')
