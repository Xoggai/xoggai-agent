import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
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

export type ApprovedPaymentTicket = {
  id: string
  status: 'APPROVED'
  challengeHash: string
  approvedAt: string
  expiresAt: string
}

export type ConsumedPaymentTicket = {
  id: string
  status: 'CONSUMED'
  challengeHash: string
  consumedAt: string
  expiresAt: string
}

export class PaymentTicketApprovalError extends Error {
  constructor(
    public readonly code:
      | 'payment_ticket_not_found'
      | 'payment_ticket_expired'
      | 'payment_ticket_already_approved'
      | 'payment_ticket_consumed'
      | 'payment_ticket_not_prepared',
  ) {
    super(code)
  }
}

export class PaymentTicketConsumeError extends Error {
  constructor(
    public readonly code:
      | 'payment_ticket_not_found'
      | 'payment_ticket_expired'
      | 'payment_ticket_consumed'
      | 'payment_ticket_not_approved',
  ) {
    super(code)
  }
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

export async function approvePreparedPaymentTicket({
  ticketId,
  approvedBy,
  now = new Date(),
}: {
  ticketId: string
  approvedBy?: string
  now?: Date
}): Promise<ApprovedPaymentTicket> {
  const [ticket] = await db
    .select({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      challengeHash: paymentPrepareTickets.challengeHash,
      expiresAt: paymentPrepareTickets.expiresAt,
      consumedAt: paymentPrepareTickets.consumedAt,
    })
    .from(paymentPrepareTickets)
    .where(eq(paymentPrepareTickets.id, ticketId))
    .limit(1)

  if (!ticket) {
    throw new PaymentTicketApprovalError('payment_ticket_not_found')
  }

  if (ticket.consumedAt) {
    throw new PaymentTicketApprovalError('payment_ticket_consumed')
  }

  if (ticket.status === 'APPROVED') {
    throw new PaymentTicketApprovalError('payment_ticket_already_approved')
  }

  if (ticket.status !== 'PREPARED') {
    throw new PaymentTicketApprovalError('payment_ticket_not_prepared')
  }

  if (ticket.expiresAt <= now) {
    throw new PaymentTicketApprovalError('payment_ticket_expired')
  }

  const [approved] = await db
    .update(paymentPrepareTickets)
    .set({
      status: 'APPROVED',
      approvedAt: now,
      approvedBy: approvedBy ?? null,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'PREPARED'),
      ),
    )
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      challengeHash: paymentPrepareTickets.challengeHash,
      approvedAt: paymentPrepareTickets.approvedAt,
      expiresAt: paymentPrepareTickets.expiresAt,
    })

  if (
    !approved ||
    approved.status !== 'APPROVED' ||
    !approved.approvedAt
  ) {
    throw new PaymentTicketApprovalError('payment_ticket_not_prepared')
  }

  return {
    id: approved.id,
    status: 'APPROVED',
    challengeHash: approved.challengeHash,
    approvedAt: approved.approvedAt.toISOString(),
    expiresAt: approved.expiresAt.toISOString(),
  }
}

export async function consumeApprovedPaymentTicket({
  ticketId,
  consumedBy,
  now = new Date(),
}: {
  ticketId: string
  consumedBy?: string
  now?: Date
}): Promise<ConsumedPaymentTicket> {
  const [ticket] = await db
    .select({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      challengeHash: paymentPrepareTickets.challengeHash,
      expiresAt: paymentPrepareTickets.expiresAt,
      consumedAt: paymentPrepareTickets.consumedAt,
    })
    .from(paymentPrepareTickets)
    .where(eq(paymentPrepareTickets.id, ticketId))
    .limit(1)

  if (!ticket) {
    throw new PaymentTicketConsumeError('payment_ticket_not_found')
  }

  if (ticket.consumedAt || ticket.status === 'CONSUMED') {
    throw new PaymentTicketConsumeError('payment_ticket_consumed')
  }

  if (ticket.status !== 'APPROVED') {
    throw new PaymentTicketConsumeError('payment_ticket_not_approved')
  }

  if (ticket.expiresAt <= now) {
    throw new PaymentTicketConsumeError('payment_ticket_expired')
  }

  const [consumed] = await db
    .update(paymentPrepareTickets)
    .set({
      status: 'CONSUMED',
      consumedAt: now,
      consumedBy: consumedBy ?? null,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'APPROVED'),
      ),
    )
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      challengeHash: paymentPrepareTickets.challengeHash,
      consumedAt: paymentPrepareTickets.consumedAt,
      expiresAt: paymentPrepareTickets.expiresAt,
    })

  if (
    !consumed ||
    consumed.status !== 'CONSUMED' ||
    !consumed.consumedAt
  ) {
    throw new PaymentTicketConsumeError('payment_ticket_not_approved')
  }

  return {
    id: consumed.id,
    status: 'CONSUMED',
    challengeHash: consumed.challengeHash,
    consumedAt: consumed.consumedAt.toISOString(),
    expiresAt: consumed.expiresAt.toISOString(),
  }
}
