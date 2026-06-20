import { createHash } from 'node:crypto'
import { db } from '../db/client.js'
import { paymentPrepareTickets } from '../db/schema.js'

export type PaymentPreview = {
  resourceUrl: string
  network: string
  asset: string
  amountAtomic: string
  amountUsdc: number
  recipient: string
  maxTimeoutSeconds: number
}

export type PreparedPaymentTicketInput = {
  requestId: string
  paymentRequiredHeader: string
  budgetUsdc: number
  preview: PaymentPreview
  now?: Date
}

export type PreparedPaymentTicket = {
  id: string
  status: 'PREPARED'
  challengeHash: string
  expiresAt: string
}

export function hashPaymentChallenge(paymentRequiredHeader: string) {
  return createHash('sha256').update(paymentRequiredHeader).digest('hex')
}

export async function createPreparedPaymentTicket({
  requestId,
  paymentRequiredHeader,
  budgetUsdc,
  preview,
  now = new Date(),
}: PreparedPaymentTicketInput): Promise<PreparedPaymentTicket> {
  const expiresAt = new Date(
    now.getTime() + preview.maxTimeoutSeconds * 1000,
  )

  const [ticket] = await db
    .insert(paymentPrepareTickets)
    .values({
      requestId,
      status: 'PREPARED',
      challengeHash: hashPaymentChallenge(paymentRequiredHeader),
      resourceUrl: preview.resourceUrl,
      network: preview.network,
      asset: preview.asset,
      recipient: preview.recipient,
      amountAtomic: preview.amountAtomic,
      amountUsdc: preview.amountUsdc,
      budgetUsdc,
      maxTimeoutSeconds: preview.maxTimeoutSeconds,
      createdAt: now,
      expiresAt,
    })
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      challengeHash: paymentPrepareTickets.challengeHash,
      expiresAt: paymentPrepareTickets.expiresAt,
    })

  if (!ticket || ticket.status !== 'PREPARED') {
    throw new Error('payment_prepare_ticket_not_created')
  }

  return {
    id: ticket.id,
    status: 'PREPARED',
    challengeHash: ticket.challengeHash,
    expiresAt: ticket.expiresAt.toISOString(),
  }
}
