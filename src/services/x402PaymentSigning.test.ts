import assert from 'node:assert/strict'
import { verifyTypedData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { SignablePaymentTicket } from './paymentPrepareTickets.js'
import { createSignedPaymentCredential } from './x402PaymentSigning.js'

const privateKey =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const account = privateKeyToAccount(privateKey)
const ticket: SignablePaymentTicket = {
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

const result = await createSignedPaymentCredential({
  ticket,
  privateKey,
  expectedAddress: account.address,
})
const payload = result.paymentPayload.payload as {
  signature: `0x${string}`
  authorization: {
    from: `0x${string}`
    to: `0x${string}`
    value: string
    validAfter: string
    validBefore: string
    nonce: `0x${string}`
  }
}

assert.equal(result.signerAddress, account.address)
assert.match(result.signatureHash, /^[0-9a-f]{64}$/)
assert.equal(result.paymentPayload.x402Version, 2)
assert.equal(result.paymentPayload.accepted.network, ticket.network)
assert.equal(payload.authorization.from, account.address)
assert.equal(payload.authorization.to, ticket.recipient)
assert.equal(payload.authorization.value, ticket.amountAtomic)
assert.equal(payload.authorization.validAfter, '0')
assert.match(payload.authorization.nonce, /^0x[0-9a-f]{64}$/)

const valid = await verifyTypedData({
  address: account.address,
  domain: {
    name: ticket.assetName,
    version: ticket.assetVersion,
    chainId: 84532,
    verifyingContract: ticket.asset as `0x${string}`,
  },
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: payload.authorization.from,
    to: payload.authorization.to,
    value: BigInt(payload.authorization.value),
    validAfter: BigInt(payload.authorization.validAfter),
    validBefore: BigInt(payload.authorization.validBefore),
    nonce: payload.authorization.nonce,
  },
  signature: payload.signature,
})
assert.equal(valid, true)

await assert.rejects(
  createSignedPaymentCredential({
    ticket,
    privateKey,
    expectedAddress: '0x0000000000000000000000000000000000000002',
  }),
  /x402_wallet_address_mismatch/,
)

await assert.rejects(
  createSignedPaymentCredential({
    ticket: { ...ticket, network: 'eip155:8453' },
    privateKey,
    expectedAddress: account.address,
  }),
  /signing_network_not_allowed/,
)

console.log('x402 payment signing tests passed')
