import assert from 'node:assert/strict'
import { auditedX402Candidate } from '../config/auditedX402.js'
import {
  PaymentPreviewError,
  preparePaymentPreview,
} from './x402PaymentPreview.js'

type RequirementOverrides = Partial<{
  scheme: string
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  resourceUrl: string
}>

function challenge(overrides: RequirementOverrides = {}) {
  const payload = {
    x402Version: 2,
    resource: {
      url: overrides.resourceUrl ?? auditedX402Candidate.resourceUrl,
    },
    accepts: [
      {
        scheme: overrides.scheme ?? 'exact',
        network: overrides.network ?? auditedX402Candidate.network,
        asset: overrides.asset ?? auditedX402Candidate.asset,
        amount: overrides.amount ?? '2000',
        payTo: overrides.payTo ?? auditedX402Candidate.recipient,
        maxTimeoutSeconds:
          overrides.maxTimeoutSeconds ??
          auditedX402Candidate.maxTimeoutSeconds,
        extra: { name: 'USDC', version: '2' },
      },
    ],
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

function expectError(overrides: RequirementOverrides, code: string) {
  assert.throws(
    () =>
      preparePaymentPreview(
        challenge(overrides),
        0.005,
        auditedX402Candidate,
      ),
    (error) => error instanceof PaymentPreviewError && error.code === code,
  )
}

const preview = preparePaymentPreview(
  challenge(),
  0.005,
  auditedX402Candidate,
)
assert.equal(preview.network, 'eip155:84532')
assert.equal(preview.amountUsdc, 0.002)
assert.equal(preview.recipient, auditedX402Candidate.recipient)
assert.equal(preview.assetName, 'USDC')
assert.equal(preview.assetVersion, '2')

assert.throws(
  () =>
    preparePaymentPreview(
      challenge(),
      0.001_999_9,
      auditedX402Candidate,
    ),
  (error) =>
    error instanceof PaymentPreviewError && error.code === 'amount_above_limit',
)

expectError({ network: 'eip155:8453' }, 'unsupported_payment_requirement')
expectError(
  { asset: '0x0000000000000000000000000000000000000000' },
  'unsupported_payment_requirement',
)
expectError(
  { payTo: '0x0000000000000000000000000000000000000000' },
  'recipient_mismatch',
)
expectError({ amount: '6000' }, 'amount_above_limit')
expectError({ maxTimeoutSeconds: 61 }, 'timeout_above_limit')
expectError({ resourceUrl: 'https://example.com/other' }, 'resource_mismatch')

assert.throws(
  () => preparePaymentPreview('not-base64-json', 0.005, auditedX402Candidate),
  (error) =>
    error instanceof PaymentPreviewError &&
    error.code === 'invalid_payment_required',
)

console.log('x402 payment preview tests passed')
