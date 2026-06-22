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
  assetName?: string
  assetVersion?: string
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

export type SignablePaymentTicket = {
  id: string
  status: 'CONSUMED'
  challengeHash: string
  resourceUrl: string
  network: string
  asset: string
  assetName: string
  assetVersion: string
  recipient: string
  amountAtomic: string
  maxTimeoutSeconds: number
  expiresAt: string
}

export type SignedPaymentTicket = {
  id: string
  status: 'SIGNED'
  challengeHash: string
  signerAddress: string
  signatureHash: string
  signedAt: string
  expiresAt: string
}

export type VerifiablePaymentTicket = Omit<
  SignablePaymentTicket,
  'status'
> & {
  status: 'SIGNED'
  signerAddress: string
  signatureHash: string
  signedAt: string
}

export type SettlementPaymentTicket = Omit<
  VerifiablePaymentTicket,
  'status'
> & {
  status: 'VERIFIED' | 'SETTLING'
  amountUsdc: number
}

export type UpstreamExecutionPaymentTicket = Omit<
  VerifiablePaymentTicket,
  'status'
> & {
  status: 'VERIFIED' | 'UPSTREAM_EXECUTING'
  amountUsdc: number
}

export type SettledPaymentTicket = {
  id: string
  status:
    | 'SETTLED'
    | 'SETTLEMENT_FAILED'
    | 'SETTLEMENT_UNKNOWN'
  settlementStatus: 'SUCCESS' | 'FAILED' | 'UNKNOWN'
  settlementTransaction?: string
  settlementNetwork?: string
  settlementErrorReason?: string
  settlementErrorMessage?: string
  settlementResultHash?: string
  settledAt: string
}

export type ExecutedPaymentTicket = {
  id: string
  status: 'EXECUTED' | 'UPSTREAM_FAILED' | 'UPSTREAM_UNKNOWN'
  upstreamStatus: 'SUCCESS' | 'FAILED' | 'UNKNOWN'
  upstreamStatusCode?: number
  upstreamErrorMessage?: string
  upstreamResponseHash?: string
  upstreamPaymentResponseHash?: string
  settlementTransaction?: string
  settlementNetwork?: string
  settlementResultHash?: string
  executedAt: string
}

export type VerifiedPaymentTicket = {
  id: string
  status: 'SIGNED' | 'VERIFIED'
  verificationStatus: 'VALID' | 'INVALID'
  verificationReason?: string
  verificationPayer?: string
  verificationResultHash: string
  facilitatorUrl: string
  verifiedAt: string
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

export class PaymentTicketSigningError extends Error {
  constructor(
    public readonly code:
      | 'payment_ticket_not_found'
      | 'payment_ticket_expired'
      | 'payment_ticket_not_consumed'
      | 'payment_ticket_already_signed'
      | 'payment_ticket_missing_signing_metadata',
  ) {
    super(code)
  }
}

export class PaymentTicketVerificationError extends Error {
  constructor(
    public readonly code:
      | 'payment_ticket_not_found'
      | 'payment_ticket_expired'
      | 'payment_ticket_not_signed'
      | 'payment_ticket_already_verified'
      | 'payment_ticket_missing_verification_metadata',
  ) {
    super(code)
  }
}

export class PaymentTicketSettlementError extends Error {
  constructor(
    public readonly code:
      | 'payment_ticket_not_found'
      | 'payment_ticket_expired'
      | 'payment_ticket_not_verified'
      | 'payment_ticket_already_settling'
      | 'payment_ticket_already_settled'
      | 'payment_ticket_verification_invalid',
  ) {
    super(code)
  }
}

export class PaymentTicketUpstreamExecutionError extends Error {
  constructor(
    public readonly code:
      | 'payment_ticket_not_found'
      | 'payment_ticket_expired'
      | 'payment_ticket_not_verified'
      | 'payment_ticket_already_executing'
      | 'payment_ticket_already_executed'
      | 'payment_ticket_verification_invalid',
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
      assetName: preview.assetName,
      assetVersion: preview.assetVersion,
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

export async function loadConsumedPaymentTicket({
  ticketId,
  now = new Date(),
}: {
  ticketId: string
  now?: Date
}): Promise<SignablePaymentTicket> {
  const [ticket] = await db
    .select()
    .from(paymentPrepareTickets)
    .where(eq(paymentPrepareTickets.id, ticketId))
    .limit(1)

  if (!ticket) {
    throw new PaymentTicketSigningError('payment_ticket_not_found')
  }
  if (ticket.signedAt || ticket.status === 'SIGNED') {
    throw new PaymentTicketSigningError('payment_ticket_already_signed')
  }
  if (ticket.status !== 'CONSUMED' || !ticket.consumedAt) {
    throw new PaymentTicketSigningError('payment_ticket_not_consumed')
  }
  if (ticket.expiresAt <= now) {
    throw new PaymentTicketSigningError('payment_ticket_expired')
  }
  if (!ticket.assetName || !ticket.assetVersion) {
    throw new PaymentTicketSigningError(
      'payment_ticket_missing_signing_metadata',
    )
  }

  return {
    id: ticket.id,
    status: 'CONSUMED',
    challengeHash: ticket.challengeHash,
    resourceUrl: ticket.resourceUrl,
    network: ticket.network,
    asset: ticket.asset,
    assetName: ticket.assetName,
    assetVersion: ticket.assetVersion,
    recipient: ticket.recipient,
    amountAtomic: ticket.amountAtomic,
    maxTimeoutSeconds: ticket.maxTimeoutSeconds,
    expiresAt: ticket.expiresAt.toISOString(),
  }
}

export async function markPaymentTicketSigned({
  ticketId,
  signerAddress,
  signatureHash,
  signedBy,
  now = new Date(),
}: {
  ticketId: string
  signerAddress: string
  signatureHash: string
  signedBy?: string
  now?: Date
}): Promise<SignedPaymentTicket> {
  const [signed] = await db
    .update(paymentPrepareTickets)
    .set({
      status: 'SIGNED',
      signedAt: now,
      signedBy: signedBy ?? null,
      signerAddress,
      signatureHash,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'CONSUMED'),
      ),
    )
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      challengeHash: paymentPrepareTickets.challengeHash,
      signerAddress: paymentPrepareTickets.signerAddress,
      signatureHash: paymentPrepareTickets.signatureHash,
      signedAt: paymentPrepareTickets.signedAt,
      expiresAt: paymentPrepareTickets.expiresAt,
    })

  if (
    !signed ||
    signed.status !== 'SIGNED' ||
    !signed.signerAddress ||
    !signed.signatureHash ||
    !signed.signedAt
  ) {
    throw new PaymentTicketSigningError('payment_ticket_already_signed')
  }

  return {
    id: signed.id,
    status: 'SIGNED',
    challengeHash: signed.challengeHash,
    signerAddress: signed.signerAddress,
    signatureHash: signed.signatureHash,
    signedAt: signed.signedAt.toISOString(),
    expiresAt: signed.expiresAt.toISOString(),
  }
}

export async function loadSignedPaymentTicket({
  ticketId,
  now = new Date(),
}: {
  ticketId: string
  now?: Date
}): Promise<VerifiablePaymentTicket> {
  const [ticket] = await db
    .select()
    .from(paymentPrepareTickets)
    .where(eq(paymentPrepareTickets.id, ticketId))
    .limit(1)

  if (!ticket) {
    throw new PaymentTicketVerificationError('payment_ticket_not_found')
  }
  if (ticket.status === 'VERIFIED') {
    throw new PaymentTicketVerificationError(
      'payment_ticket_already_verified',
    )
  }
  if (
    ticket.status !== 'SIGNED' ||
    !ticket.signedAt ||
    !ticket.signerAddress ||
    !ticket.signatureHash
  ) {
    throw new PaymentTicketVerificationError('payment_ticket_not_signed')
  }
  if (ticket.expiresAt <= now) {
    throw new PaymentTicketVerificationError('payment_ticket_expired')
  }
  if (!ticket.assetName || !ticket.assetVersion) {
    throw new PaymentTicketVerificationError(
      'payment_ticket_missing_verification_metadata',
    )
  }

  return {
    id: ticket.id,
    status: 'SIGNED',
    challengeHash: ticket.challengeHash,
    resourceUrl: ticket.resourceUrl,
    network: ticket.network,
    asset: ticket.asset,
    assetName: ticket.assetName,
    assetVersion: ticket.assetVersion,
    recipient: ticket.recipient,
    amountAtomic: ticket.amountAtomic,
    maxTimeoutSeconds: ticket.maxTimeoutSeconds,
    signerAddress: ticket.signerAddress,
    signatureHash: ticket.signatureHash,
    signedAt: ticket.signedAt.toISOString(),
    expiresAt: ticket.expiresAt.toISOString(),
  }
}

export async function recordPaymentVerification({
  ticketId,
  isValid,
  invalidReason,
  payer,
  resultHash,
  facilitatorUrl,
  verifiedBy,
  now = new Date(),
}: {
  ticketId: string
  isValid: boolean
  invalidReason?: string
  payer?: string
  resultHash: string
  facilitatorUrl: string
  verifiedBy?: string
  now?: Date
}): Promise<VerifiedPaymentTicket> {
  const [verified] = await db
    .update(paymentPrepareTickets)
    .set({
      status: isValid ? 'VERIFIED' : 'SIGNED',
      verificationStatus: isValid ? 'VALID' : 'INVALID',
      verificationReason: invalidReason ?? null,
      verificationPayer: payer ?? null,
      verificationResultHash: resultHash,
      facilitatorUrl,
      verifiedAt: now,
      verifiedBy: verifiedBy ?? null,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'SIGNED'),
      ),
    )
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      verificationStatus: paymentPrepareTickets.verificationStatus,
      verificationReason: paymentPrepareTickets.verificationReason,
      verificationPayer: paymentPrepareTickets.verificationPayer,
      verificationResultHash:
        paymentPrepareTickets.verificationResultHash,
      facilitatorUrl: paymentPrepareTickets.facilitatorUrl,
      verifiedAt: paymentPrepareTickets.verifiedAt,
      expiresAt: paymentPrepareTickets.expiresAt,
    })

  if (
    !verified ||
    (verified.status !== 'SIGNED' && verified.status !== 'VERIFIED') ||
    (verified.verificationStatus !== 'VALID' &&
      verified.verificationStatus !== 'INVALID') ||
    !verified.verificationResultHash ||
    !verified.facilitatorUrl ||
    !verified.verifiedAt
  ) {
    throw new PaymentTicketVerificationError(
      'payment_ticket_already_verified',
    )
  }

  return {
    id: verified.id,
    status: verified.status,
    verificationStatus: verified.verificationStatus,
    ...(verified.verificationReason
      ? { verificationReason: verified.verificationReason }
      : {}),
    ...(verified.verificationPayer
      ? { verificationPayer: verified.verificationPayer }
      : {}),
    verificationResultHash: verified.verificationResultHash,
    facilitatorUrl: verified.facilitatorUrl,
    verifiedAt: verified.verifiedAt.toISOString(),
    expiresAt: verified.expiresAt.toISOString(),
  }
}

export async function loadVerifiedPaymentTicket({
  ticketId,
  now = new Date(),
}: {
  ticketId: string
  now?: Date
}): Promise<SettlementPaymentTicket> {
  const [ticket] = await db
    .select()
    .from(paymentPrepareTickets)
    .where(eq(paymentPrepareTickets.id, ticketId))
    .limit(1)

  if (!ticket) {
    throw new PaymentTicketSettlementError('payment_ticket_not_found')
  }
  if (
    ticket.status === 'SETTLED' ||
    ticket.status === 'SETTLEMENT_FAILED' ||
    ticket.status === 'SETTLEMENT_UNKNOWN'
  ) {
    throw new PaymentTicketSettlementError(
      'payment_ticket_already_settled',
    )
  }
  if (ticket.status === 'SETTLING') {
    throw new PaymentTicketSettlementError(
      'payment_ticket_already_settling',
    )
  }
  if (
    ticket.status !== 'VERIFIED' ||
    ticket.verificationStatus !== 'VALID'
  ) {
    throw new PaymentTicketSettlementError(
      ticket.verificationStatus === 'INVALID'
        ? 'payment_ticket_verification_invalid'
        : 'payment_ticket_not_verified',
    )
  }
  if (ticket.expiresAt <= now) {
    throw new PaymentTicketSettlementError('payment_ticket_expired')
  }
  if (
    !ticket.assetName ||
    !ticket.assetVersion ||
    !ticket.signerAddress ||
    !ticket.signatureHash ||
    !ticket.signedAt
  ) {
    throw new PaymentTicketSettlementError(
      'payment_ticket_not_verified',
    )
  }

  return {
    id: ticket.id,
    status: 'VERIFIED',
    challengeHash: ticket.challengeHash,
    resourceUrl: ticket.resourceUrl,
    network: ticket.network,
    asset: ticket.asset,
    assetName: ticket.assetName,
    assetVersion: ticket.assetVersion,
    recipient: ticket.recipient,
    amountAtomic: ticket.amountAtomic,
    amountUsdc: ticket.amountUsdc,
    maxTimeoutSeconds: ticket.maxTimeoutSeconds,
    signerAddress: ticket.signerAddress,
    signatureHash: ticket.signatureHash,
    signedAt: ticket.signedAt.toISOString(),
    expiresAt: ticket.expiresAt.toISOString(),
  }
}

export async function claimVerifiedPaymentTicketForSettlement({
  ticketId,
  settledBy,
  now = new Date(),
}: {
  ticketId: string
  settledBy?: string
  now?: Date
}): Promise<void> {
  const [claimed] = await db
    .update(paymentPrepareTickets)
    .set({
      status: 'SETTLING',
      settlementStatus: 'PENDING',
      settlementStartedAt: now,
      settledBy: settledBy ?? null,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'VERIFIED'),
      ),
    )
    .returning({ id: paymentPrepareTickets.id })

  if (!claimed) {
    throw new PaymentTicketSettlementError(
      'payment_ticket_already_settling',
    )
  }
}

export async function recordPaymentSettlement({
  ticketId,
  success,
  unknown = false,
  errorReason,
  errorMessage,
  transaction,
  network,
  resultHash,
  now = new Date(),
}: {
  ticketId: string
  success: boolean
  unknown?: boolean
  errorReason?: string
  errorMessage?: string
  transaction?: string
  network?: string
  resultHash?: string
  now?: Date
}): Promise<SettledPaymentTicket> {
  const status = success
    ? 'SETTLED'
    : unknown
      ? 'SETTLEMENT_UNKNOWN'
      : 'SETTLEMENT_FAILED'
  const settlementStatus = success
    ? 'SUCCESS'
    : unknown
      ? 'UNKNOWN'
      : 'FAILED'
  const [settled] = await db
    .update(paymentPrepareTickets)
    .set({
      status,
      settlementStatus,
      settlementErrorReason: errorReason ?? null,
      settlementErrorMessage: errorMessage ?? null,
      settlementTransaction: transaction ?? null,
      settlementNetwork: network ?? null,
      settlementResultHash: resultHash ?? null,
      settledAt: now,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'SETTLING'),
      ),
    )
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      settlementStatus: paymentPrepareTickets.settlementStatus,
      settlementTransaction:
        paymentPrepareTickets.settlementTransaction,
      settlementNetwork: paymentPrepareTickets.settlementNetwork,
      settlementErrorReason:
        paymentPrepareTickets.settlementErrorReason,
      settlementErrorMessage:
        paymentPrepareTickets.settlementErrorMessage,
      settlementResultHash:
        paymentPrepareTickets.settlementResultHash,
      settledAt: paymentPrepareTickets.settledAt,
    })

  if (
    !settled ||
    !settled.settledAt ||
    !['SETTLED', 'SETTLEMENT_FAILED', 'SETTLEMENT_UNKNOWN'].includes(
      settled.status,
    ) ||
    !['SUCCESS', 'FAILED', 'UNKNOWN'].includes(
      settled.settlementStatus ?? '',
    )
  ) {
    throw new PaymentTicketSettlementError(
      'payment_ticket_already_settled',
    )
  }

  return {
    id: settled.id,
    status: settled.status as SettledPaymentTicket['status'],
    settlementStatus:
      settled.settlementStatus as SettledPaymentTicket['settlementStatus'],
    ...(settled.settlementTransaction
      ? { settlementTransaction: settled.settlementTransaction }
      : {}),
    ...(settled.settlementNetwork
      ? { settlementNetwork: settled.settlementNetwork }
      : {}),
    ...(settled.settlementErrorReason
      ? { settlementErrorReason: settled.settlementErrorReason }
      : {}),
    ...(settled.settlementErrorMessage
      ? { settlementErrorMessage: settled.settlementErrorMessage }
      : {}),
    ...(settled.settlementResultHash
      ? { settlementResultHash: settled.settlementResultHash }
      : {}),
    settledAt: settled.settledAt.toISOString(),
  }
}

export async function loadVerifiedPaymentTicketForUpstream({
  ticketId,
  now = new Date(),
}: {
  ticketId: string
  now?: Date
}): Promise<UpstreamExecutionPaymentTicket> {
  const [ticket] = await db
    .select()
    .from(paymentPrepareTickets)
    .where(eq(paymentPrepareTickets.id, ticketId))
    .limit(1)

  if (!ticket) {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_not_found',
    )
  }
  if (
    ticket.status === 'EXECUTED' ||
    ticket.status === 'UPSTREAM_FAILED' ||
    ticket.status === 'UPSTREAM_UNKNOWN' ||
    ticket.status === 'SETTLED' ||
    ticket.status === 'SETTLEMENT_FAILED' ||
    ticket.status === 'SETTLEMENT_UNKNOWN'
  ) {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_already_executed',
    )
  }
  if (ticket.status === 'UPSTREAM_EXECUTING') {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_already_executing',
    )
  }
  if (
    ticket.status !== 'VERIFIED' ||
    ticket.verificationStatus !== 'VALID'
  ) {
    throw new PaymentTicketUpstreamExecutionError(
      ticket.verificationStatus === 'INVALID'
        ? 'payment_ticket_verification_invalid'
        : 'payment_ticket_not_verified',
    )
  }
  if (ticket.expiresAt <= now) {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_expired',
    )
  }
  if (
    !ticket.assetName ||
    !ticket.assetVersion ||
    !ticket.signerAddress ||
    !ticket.signatureHash ||
    !ticket.signedAt
  ) {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_not_verified',
    )
  }

  return {
    id: ticket.id,
    status: 'VERIFIED',
    challengeHash: ticket.challengeHash,
    resourceUrl: ticket.resourceUrl,
    network: ticket.network,
    asset: ticket.asset,
    assetName: ticket.assetName,
    assetVersion: ticket.assetVersion,
    recipient: ticket.recipient,
    amountAtomic: ticket.amountAtomic,
    amountUsdc: ticket.amountUsdc,
    maxTimeoutSeconds: ticket.maxTimeoutSeconds,
    signerAddress: ticket.signerAddress,
    signatureHash: ticket.signatureHash,
    signedAt: ticket.signedAt.toISOString(),
    expiresAt: ticket.expiresAt.toISOString(),
  }
}

export async function claimVerifiedPaymentTicketForUpstream({
  ticketId,
  executedBy,
  now = new Date(),
}: {
  ticketId: string
  executedBy?: string
  now?: Date
}): Promise<void> {
  const [claimed] = await db
    .update(paymentPrepareTickets)
    .set({
      status: 'UPSTREAM_EXECUTING',
      upstreamStatus: 'PENDING',
      upstreamStartedAt: now,
      upstreamExecutedBy: executedBy ?? null,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'VERIFIED'),
      ),
    )
    .returning({ id: paymentPrepareTickets.id })

  if (!claimed) {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_already_executing',
    )
  }
}

export async function recordUpstreamExecution({
  ticketId,
  success,
  unknown = false,
  statusCode,
  errorMessage,
  responseHash,
  paymentResponseHash,
  settlementTransaction,
  settlementNetwork,
  settlementResultHash,
  now = new Date(),
}: {
  ticketId: string
  success: boolean
  unknown?: boolean
  statusCode?: number
  errorMessage?: string
  responseHash?: string
  paymentResponseHash?: string
  settlementTransaction?: string
  settlementNetwork?: string
  settlementResultHash?: string
  now?: Date
}): Promise<ExecutedPaymentTicket> {
  const status = success
    ? 'EXECUTED'
    : unknown
      ? 'UPSTREAM_UNKNOWN'
      : 'UPSTREAM_FAILED'
  const upstreamStatus = success
    ? 'SUCCESS'
    : unknown
      ? 'UNKNOWN'
      : 'FAILED'
  const [executed] = await db
    .update(paymentPrepareTickets)
    .set({
      status,
      upstreamStatus,
      upstreamStatusCode: statusCode ?? null,
      upstreamErrorMessage: errorMessage ?? null,
      upstreamResponseHash: responseHash ?? null,
      upstreamPaymentResponseHash: paymentResponseHash ?? null,
      upstreamCompletedAt: now,
      settlementStatus: success ? 'SUCCESS' : null,
      settlementTransaction: settlementTransaction ?? null,
      settlementNetwork: settlementNetwork ?? null,
      settlementResultHash: settlementResultHash ?? null,
      settledAt: success ? now : null,
    })
    .where(
      and(
        eq(paymentPrepareTickets.id, ticketId),
        eq(paymentPrepareTickets.status, 'UPSTREAM_EXECUTING'),
      ),
    )
    .returning({
      id: paymentPrepareTickets.id,
      status: paymentPrepareTickets.status,
      upstreamStatus: paymentPrepareTickets.upstreamStatus,
      upstreamStatusCode: paymentPrepareTickets.upstreamStatusCode,
      upstreamErrorMessage: paymentPrepareTickets.upstreamErrorMessage,
      upstreamResponseHash: paymentPrepareTickets.upstreamResponseHash,
      upstreamPaymentResponseHash:
        paymentPrepareTickets.upstreamPaymentResponseHash,
      settlementTransaction:
        paymentPrepareTickets.settlementTransaction,
      settlementNetwork: paymentPrepareTickets.settlementNetwork,
      settlementResultHash:
        paymentPrepareTickets.settlementResultHash,
      upstreamCompletedAt: paymentPrepareTickets.upstreamCompletedAt,
    })

  if (
    !executed ||
    !executed.upstreamCompletedAt ||
    !['EXECUTED', 'UPSTREAM_FAILED', 'UPSTREAM_UNKNOWN'].includes(
      executed.status,
    ) ||
    !['SUCCESS', 'FAILED', 'UNKNOWN'].includes(
      executed.upstreamStatus ?? '',
    )
  ) {
    throw new PaymentTicketUpstreamExecutionError(
      'payment_ticket_already_executed',
    )
  }

  return {
    id: executed.id,
    status: executed.status as ExecutedPaymentTicket['status'],
    upstreamStatus:
      executed.upstreamStatus as ExecutedPaymentTicket['upstreamStatus'],
    ...(typeof executed.upstreamStatusCode === 'number'
      ? { upstreamStatusCode: executed.upstreamStatusCode }
      : {}),
    ...(executed.upstreamErrorMessage
      ? { upstreamErrorMessage: executed.upstreamErrorMessage }
      : {}),
    ...(executed.upstreamResponseHash
      ? { upstreamResponseHash: executed.upstreamResponseHash }
      : {}),
    ...(executed.upstreamPaymentResponseHash
      ? {
          upstreamPaymentResponseHash:
            executed.upstreamPaymentResponseHash,
        }
      : {}),
    ...(executed.settlementTransaction
      ? { settlementTransaction: executed.settlementTransaction }
      : {}),
    ...(executed.settlementNetwork
      ? { settlementNetwork: executed.settlementNetwork }
      : {}),
    ...(executed.settlementResultHash
      ? { settlementResultHash: executed.settlementResultHash }
      : {}),
    executedAt: executed.upstreamCompletedAt.toISOString(),
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
