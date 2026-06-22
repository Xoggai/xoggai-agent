import { createHash } from 'node:crypto'
import type { PaymentPayload } from '@x402/core/types'
import type { UpstreamExecutionPaymentTicket } from './paymentPrepareTickets.js'
import { assertPaymentPayloadMatchesTicket } from './x402PaymentVerification.js'

export class X402UpstreamExecutionError extends Error {
  constructor(
    public readonly code:
      | 'upstream_execution_confirmation_required'
      | 'upstream_network_not_allowed'
      | 'upstream_resource_not_allowed'
      | 'upstream_budget_exceeded'
      | 'upstream_payment_response_missing'
      | 'upstream_payment_response_invalid',
    message = code,
  ) {
    super(message)
  }
}

export type X402UpstreamPolicy = {
  method: 'GET'
  resourceUrl: string
  network: string
  maxAmountAtomic: bigint
}

export type UpstreamExecutionResult = {
  success: boolean
  statusCode: number
  responseHash: string
  responsePreview: string
  paymentResponseHash?: string
  settlement?: {
    success?: boolean
    transaction?: string
    network?: string
    errorReason?: string
    errorMessage?: string
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function encodePaymentSignatureHeader(paymentPayload: PaymentPayload) {
  return Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString('base64')
}

export function decodePaymentResponseHeader(header: string) {
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as {
      success?: boolean
      transaction?: string
      network?: string
      errorReason?: string
      errorMessage?: string
    }
  } catch {
    throw new X402UpstreamExecutionError(
      'upstream_payment_response_invalid',
    )
  }
}

export function assertUpstreamExecutionRequest({
  ticket,
  paymentPayload,
  policy,
  maxBudgetUsdc,
  executionConfirmation,
}: {
  ticket: UpstreamExecutionPaymentTicket
  paymentPayload: PaymentPayload
  policy: X402UpstreamPolicy
  maxBudgetUsdc: number
  executionConfirmation: string
}) {
  if (executionConfirmation !== 'EXECUTE_X402_BASE_SEPOLIA') {
    throw new X402UpstreamExecutionError(
      'upstream_execution_confirmation_required',
    )
  }
  if (
    ticket.network !== policy.network ||
    paymentPayload.accepted.network !== policy.network ||
    policy.network !== 'eip155:84532'
  ) {
    throw new X402UpstreamExecutionError('upstream_network_not_allowed')
  }
  if (
    ticket.resourceUrl !== policy.resourceUrl ||
    paymentPayload.resource?.url !== policy.resourceUrl
  ) {
    throw new X402UpstreamExecutionError('upstream_resource_not_allowed')
  }
  const amountAtomic = BigInt(ticket.amountAtomic)
  if (
    ticket.amountUsdc > maxBudgetUsdc ||
    ticket.amountUsdc > 0.005 ||
    amountAtomic > policy.maxAmountAtomic
  ) {
    throw new X402UpstreamExecutionError('upstream_budget_exceeded')
  }

  assertPaymentPayloadMatchesTicket(ticket, paymentPayload)
}

export async function executeVerifiedX402Resource({
  ticket,
  paymentPayload,
  policy,
  maxBudgetUsdc,
  executionConfirmation,
  fetchImpl = fetch,
}: {
  ticket: UpstreamExecutionPaymentTicket
  paymentPayload: PaymentPayload
  policy: X402UpstreamPolicy
  maxBudgetUsdc: number
  executionConfirmation: string
  fetchImpl?: typeof fetch
}): Promise<UpstreamExecutionResult> {
  assertUpstreamExecutionRequest({
    ticket,
    paymentPayload,
    policy,
    maxBudgetUsdc,
    executionConfirmation,
  })

  const response = await fetchImpl(policy.resourceUrl, {
    method: policy.method,
    headers: {
      accept: 'application/json',
      'PAYMENT-SIGNATURE': encodePaymentSignatureHeader(paymentPayload),
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.text()
  const responseHash = sha256(body)
  const paymentResponseHeader = response.headers.get('PAYMENT-RESPONSE')

  if (response.ok && !paymentResponseHeader) {
    throw new X402UpstreamExecutionError(
      'upstream_payment_response_missing',
    )
  }

  const settlement = paymentResponseHeader
    ? decodePaymentResponseHeader(paymentResponseHeader)
    : undefined
  const paymentResponseHash = paymentResponseHeader
    ? sha256(paymentResponseHeader)
    : undefined

  return {
    success: response.ok && settlement?.success !== false,
    statusCode: response.status,
    responseHash,
    responsePreview: body.slice(0, 2_000),
    ...(paymentResponseHash ? { paymentResponseHash } : {}),
    ...(settlement ? { settlement } : {}),
  }
}
