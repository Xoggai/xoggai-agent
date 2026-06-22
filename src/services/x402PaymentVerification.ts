import { createHash } from 'node:crypto'
import { HTTPFacilitatorClient } from '@x402/core/http'
import { VerifyError } from '@x402/core/types'
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
} from '@x402/core/types'
import { getAddress } from 'viem'
import type { VerifiablePaymentTicket } from './paymentPrepareTickets.js'

export type PaymentPayloadBindingTicket = Omit<
  VerifiablePaymentTicket,
  'status'
>

export class PaymentVerificationError extends Error {
  constructor(
    public readonly code:
      | 'verification_network_not_allowed'
      | 'verification_payload_mismatch'
      | 'verification_signature_mismatch'
      | 'verification_facilitator_not_allowed',
  ) {
    super(code)
  }
}

function signatureFromPayload(paymentPayload: PaymentPayload) {
  const payload = paymentPayload.payload as { signature?: unknown }
  if (typeof payload.signature !== 'string') {
    throw new PaymentVerificationError('verification_payload_mismatch')
  }
  return payload.signature
}

export function assertPaymentPayloadMatchesTicket(
  ticket: PaymentPayloadBindingTicket,
  paymentPayload: PaymentPayload,
) {
  if (
    ticket.network !== 'eip155:84532' ||
    paymentPayload.accepted.network !== 'eip155:84532'
  ) {
    throw new PaymentVerificationError('verification_network_not_allowed')
  }

  const accepted = paymentPayload.accepted
  const authorization = paymentPayload.payload as {
    authorization?: {
      from?: string
      to?: string
      value?: string
    }
  }
  const resourceUrl = paymentPayload.resource?.url
  const matches =
    paymentPayload.x402Version === 2 &&
    accepted.scheme === 'exact' &&
    resourceUrl === ticket.resourceUrl &&
    accepted.network === ticket.network &&
    accepted.asset.toLowerCase() === ticket.asset.toLowerCase() &&
    accepted.amount === ticket.amountAtomic &&
    accepted.payTo.toLowerCase() === ticket.recipient.toLowerCase() &&
    accepted.maxTimeoutSeconds === ticket.maxTimeoutSeconds &&
    accepted.extra?.name === ticket.assetName &&
    accepted.extra?.version === ticket.assetVersion &&
    authorization.authorization?.from &&
    getAddress(authorization.authorization.from) ===
      getAddress(ticket.signerAddress) &&
    authorization.authorization.to &&
    getAddress(authorization.authorization.to) ===
      getAddress(ticket.recipient) &&
    authorization.authorization.value === ticket.amountAtomic

  if (!matches) {
    throw new PaymentVerificationError('verification_payload_mismatch')
  }

  const signatureHash = createHash('sha256')
    .update(signatureFromPayload(paymentPayload))
    .digest('hex')
  if (signatureHash !== ticket.signatureHash) {
    throw new PaymentVerificationError('verification_signature_mismatch')
  }
}

export type PaymentVerificationResult = {
  facilitatorUrl: string
  resultHash: string
  response: VerifyResponse
}

async function verifyWithTimeout(
  facilitator: Pick<HTTPFacilitatorClient, 'verify'>,
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
) {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      facilitator.verify(paymentPayload, requirements),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('facilitator_verify_timeout')),
          15_000,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function verifySignedPaymentCredential({
  ticket,
  paymentPayload,
  facilitatorUrl,
  facilitatorClient,
}: {
  ticket: VerifiablePaymentTicket
  paymentPayload: PaymentPayload
  facilitatorUrl: string
  facilitatorClient?: Pick<HTTPFacilitatorClient, 'verify'>
}): Promise<PaymentVerificationResult> {
  const url = new URL(facilitatorUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'x402.org') {
    throw new PaymentVerificationError(
      'verification_facilitator_not_allowed',
    )
  }

  assertPaymentPayloadMatchesTicket(ticket, paymentPayload)
  const requirements: PaymentRequirements = paymentPayload.accepted
  const facilitator =
    facilitatorClient ??
    new HTTPFacilitatorClient({
      url: url.toString().replace(/\/+$/, ''),
    })
  let response: VerifyResponse
  try {
    response = await verifyWithTimeout(
      facilitator,
      paymentPayload,
      requirements,
    )
  } catch (error) {
    if (!(error instanceof VerifyError)) {
      throw error
    }
    response = {
      isValid: false,
      ...(error.invalidReason
        ? { invalidReason: error.invalidReason }
        : {}),
      ...(error.invalidMessage
        ? { invalidMessage: error.invalidMessage }
        : {}),
      ...(error.payer ? { payer: error.payer } : {}),
    }
  }

  return {
    facilitatorUrl: url.toString().replace(/\/+$/, ''),
    resultHash: createHash('sha256')
      .update(JSON.stringify(response))
      .digest('hex'),
    response,
  }
}
