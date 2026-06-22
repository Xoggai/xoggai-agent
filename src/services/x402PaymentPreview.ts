import { z } from 'zod'

const paymentRequirementSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  asset: z.string(),
  amount: z.string().regex(/^\d+$/),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z
    .object({
      name: z.string().min(1),
      version: z.string().min(1),
    })
    .passthrough()
    .optional(),
})

const challengeSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({ url: z.string().url() }),
  accepts: z.array(paymentRequirementSchema).min(1),
})

export type PaymentPreviewPolicy = {
  resourceUrl: string
  network: string
  asset: string
  recipient: string
  maxAmountAtomic: bigint
  maxTimeoutSeconds: number
}

export class PaymentPreviewError extends Error {
  constructor(
    public readonly code:
      | 'invalid_payment_required'
      | 'resource_mismatch'
      | 'unsupported_payment_requirement'
      | 'recipient_mismatch'
      | 'amount_above_limit'
      | 'timeout_above_limit',
  ) {
    super(code)
  }
}

function decodePaymentRequired(header: string) {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8')
    return challengeSchema.parse(JSON.parse(decoded))
  } catch {
    throw new PaymentPreviewError('invalid_payment_required')
  }
}

export function preparePaymentPreview(
  paymentRequiredHeader: string,
  budgetUsdc: number,
  policy: PaymentPreviewPolicy,
) {
  const challenge = decodePaymentRequired(paymentRequiredHeader)

  if (challenge.resource.url !== policy.resourceUrl) {
    throw new PaymentPreviewError('resource_mismatch')
  }

  const requirement = challenge.accepts.find(
    (candidate) =>
      candidate.scheme === 'exact' &&
      candidate.network === policy.network &&
      candidate.asset.toLowerCase() === policy.asset.toLowerCase(),
  )

  if (!requirement) {
    throw new PaymentPreviewError('unsupported_payment_requirement')
  }

  if (requirement.payTo.toLowerCase() !== policy.recipient.toLowerCase()) {
    throw new PaymentPreviewError('recipient_mismatch')
  }

  const amountAtomic = BigInt(requirement.amount)
  const budgetAtomic = BigInt(Math.floor(budgetUsdc * 1_000_000))
  if (amountAtomic > policy.maxAmountAtomic || amountAtomic > budgetAtomic) {
    throw new PaymentPreviewError('amount_above_limit')
  }

  if (requirement.maxTimeoutSeconds > policy.maxTimeoutSeconds) {
    throw new PaymentPreviewError('timeout_above_limit')
  }

  return {
    x402Version: challenge.x402Version,
    resourceUrl: challenge.resource.url,
    scheme: requirement.scheme,
    network: requirement.network,
    asset: requirement.asset,
    amountAtomic: requirement.amount,
    amountUsdc: Number(amountAtomic) / 1_000_000,
    recipient: requirement.payTo,
    maxTimeoutSeconds: requirement.maxTimeoutSeconds,
    assetName: requirement.extra?.name,
    assetVersion: requirement.extra?.version,
  }
}
