import { auditedX402Candidate } from '../config/auditedX402.js'
import { env } from '../env.js'
import {
  auditPublicBetaRequestExecution,
  claimPublicBetaRequestForTestnetExecution,
  getPublicBetaExecutionRequest,
  PublicBetaExecutionError,
  updatePublicBetaRequestExecution,
} from './publicBetaRequests.js'
import { executionEndpointAllowed } from './executionAllowlist.js'
import {
  approvePreparedPaymentTicket,
  claimVerifiedPaymentTicketForUpstream,
  consumeApprovedPaymentTicket,
  createPreparedPaymentTicket,
  loadConsumedPaymentTicket,
  loadSignedPaymentTicket,
  loadVerifiedPaymentTicketForUpstream,
  markPaymentTicketSigned,
  recordPaymentVerification,
  recordUpstreamExecution,
} from './paymentPrepareTickets.js'
import {
  PaymentPreviewError,
  preparePaymentPreview,
} from './x402PaymentPreview.js'
import { createSignedPaymentCredential } from './x402PaymentSigning.js'
import { verifySignedPaymentCredential } from './x402PaymentVerification.js'
import { executeVerifiedX402Resource } from './x402UpstreamExecution.js'

export class PublicBetaTestnetExecutionConfigError extends Error {
  constructor(
    public readonly code:
      | 'testnet_execution_not_configured'
      | 'testnet_execution_wallet_not_configured'
      | 'testnet_execution_network_not_configured',
  ) {
    super(code)
  }
}

function assertPhase9Ready() {
  if (
    !env.X402_PREPARE_ENABLED ||
    !env.X402_SIGNING_ENABLED ||
    !env.X402_VERIFY_ENABLED ||
    !env.X402_UPSTREAM_EXECUTION_ENABLED
  ) {
    throw new PublicBetaTestnetExecutionConfigError(
      'testnet_execution_not_configured',
    )
  }
  if (env.X402_NETWORK !== 'base-sepolia') {
    throw new PublicBetaTestnetExecutionConfigError(
      'testnet_execution_network_not_configured',
    )
  }
  if (!env.X402_WALLET_PRIVATE_KEY || !env.X402_WALLET_ADDRESS) {
    throw new PublicBetaTestnetExecutionConfigError(
      'testnet_execution_wallet_not_configured',
    )
  }
}

async function fetchPaymentChallenge() {
  const response = await fetch(auditedX402Candidate.resourceUrl, {
    method: auditedX402Candidate.method,
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  })
  return {
    status: response.status,
    paymentRequired: response.headers.get('payment-required') ?? undefined,
  }
}

function betaKeyIdForUser(userId: string) {
  return `public-beta:${userId}`
}

export async function executeApprovedPublicBetaRequestOnTestnet(input: {
  requestId: string
  executedBy: string
}) {
  assertPhase9Ready()
  const walletPrivateKey = env.X402_WALLET_PRIVATE_KEY as string
  const walletAddress = env.X402_WALLET_ADDRESS as string

  const pendingRequest = await getPublicBetaExecutionRequest(input.requestId)
  if (pendingRequest.status !== 'APPROVED') {
    throw new PublicBetaExecutionError(
      pendingRequest.status === 'EXPIRED'
        ? 'beta_execution_request_expired'
        : 'beta_execution_request_not_approved',
    )
  }
  const allowlisted = await executionEndpointAllowed({
    endpointId: pendingRequest.endpointId,
    endpointUrl: pendingRequest.endpointUrl,
  })
  const resourceMatches =
    pendingRequest.endpointUrl === auditedX402Candidate.resourceUrl
  if (!allowlisted || !resourceMatches) {
    await auditPublicBetaRequestExecution({
      userId: pendingRequest.userId,
      requestId: pendingRequest.id,
      actorId: input.executedBy,
      action: 'TESTNET_EXECUTION_BLOCKED',
      severity: 'SECURITY',
      outcome: 'DENIED',
      metadata: {
        reason: allowlisted
          ? 'endpoint_resource_mismatch'
          : 'endpoint_not_allowlisted',
      },
    })
    throw new PublicBetaExecutionError('endpoint_not_allowlisted')
  }

  const request = await claimPublicBetaRequestForTestnetExecution({
    id: input.requestId,
    executedBy: input.executedBy,
  })
  const betaKeyId = betaKeyIdForUser(request.userId)

  try {
    const challenge = await fetchPaymentChallenge()
    if (challenge.status !== 402 || !challenge.paymentRequired) {
      throw new PaymentPreviewError('invalid_payment_required')
    }
    const preview = preparePaymentPreview(
      challenge.paymentRequired,
      request.budgetUsdc,
      auditedX402Candidate,
    )
    const prepared = await createPreparedPaymentTicket({
      requestId: request.id,
      paymentRequiredHeader: challenge.paymentRequired,
      budgetUsdc: request.budgetUsdc,
      preview,
      betaKeyId,
      betaClientLabel: `public-beta:${request.userId}`,
    })
    await updatePublicBetaRequestExecution({
      id: request.id,
      status: 'TESTNET_PREPARED',
      paymentTicketId: prepared.id,
    })

    const approved = await approvePreparedPaymentTicket({
      ticketId: prepared.id,
      approvedBy: input.executedBy,
      betaKeyId,
    })
    const consumed = await consumeApprovedPaymentTicket({
      ticketId: approved.id,
      consumedBy: input.executedBy,
      betaKeyId,
    })
    await updatePublicBetaRequestExecution({
      id: request.id,
      status: 'TESTNET_SIGNING',
      paymentTicketId: consumed.id,
    })

    const signableTicket = await loadConsumedPaymentTicket({
      ticketId: consumed.id,
      betaKeyId,
    })
    const credential = await createSignedPaymentCredential({
      ticket: signableTicket,
      privateKey: walletPrivateKey,
      expectedAddress: walletAddress,
    })
    const signed = await markPaymentTicketSigned({
      ticketId: consumed.id,
      signerAddress: credential.signerAddress,
      signatureHash: credential.signatureHash,
      signedBy: input.executedBy,
    })

    await updatePublicBetaRequestExecution({
      id: request.id,
      status: 'TESTNET_VERIFYING',
      paymentTicketId: signed.id,
    })

    const verifiableTicket = await loadSignedPaymentTicket({
      ticketId: signed.id,
      betaKeyId,
    })
    const verification = await verifySignedPaymentCredential({
      ticket: verifiableTicket,
      paymentPayload: credential.paymentPayload,
      facilitatorUrl: env.X402_FACILITATOR_URL,
    })
    const verified = await recordPaymentVerification({
      ticketId: signed.id,
      isValid: verification.response.isValid === true,
      invalidReason: verification.response.invalidReason,
      payer: verification.response.payer,
      resultHash: verification.resultHash,
      facilitatorUrl: verification.facilitatorUrl,
      verifiedBy: input.executedBy,
    })
    if (verified.verificationStatus !== 'VALID') {
      throw new Error(
        verified.verificationReason ?? 'payment_verification_invalid',
      )
    }

    await updatePublicBetaRequestExecution({
      id: request.id,
      status: 'TESTNET_EXECUTING',
      paymentTicketId: verified.id,
    })

    const executableTicket = await loadVerifiedPaymentTicketForUpstream({
      ticketId: verified.id,
      betaKeyId,
    })
    await claimVerifiedPaymentTicketForUpstream({
      ticketId: executableTicket.id,
      executedBy: input.executedBy,
    })
    const upstream = await executeVerifiedX402Resource({
      ticket: executableTicket,
      paymentPayload: credential.paymentPayload,
      policy: auditedX402Candidate,
      maxBudgetUsdc: env.MAX_EXECUTION_BUDGET_USDC,
      executionConfirmation: 'EXECUTE_X402_BASE_SEPOLIA',
    })
    const executed = await recordUpstreamExecution({
      ticketId: executableTicket.id,
      success: upstream.success,
      statusCode: upstream.statusCode,
      responseHash: upstream.responseHash,
      paymentResponseHash: upstream.paymentResponseHash,
      settlementTransaction: upstream.settlement?.transaction,
      settlementNetwork: upstream.settlement?.network,
      settlementResultHash: upstream.paymentResponseHash,
    })

    const finalRequest = await updatePublicBetaRequestExecution({
      id: request.id,
      status: upstream.success ? 'EXECUTED' : 'EXECUTION_FAILED',
      paymentTicketId: executed.id,
      upstreamStatusCode: upstream.statusCode,
      upstreamResponseHash: upstream.responseHash,
      upstreamPaymentResponseHash: upstream.paymentResponseHash,
      settlementTransaction: upstream.settlement?.transaction,
      settlementNetwork: upstream.settlement?.network,
      executedAt: new Date(executed.executedAt),
      executionError: upstream.success
        ? null
        : upstream.settlement?.errorReason ??
          upstream.settlement?.errorMessage ??
          'upstream_execution_failed',
    })

    await auditPublicBetaRequestExecution({
      userId: request.userId,
      requestId: request.id,
      actorId: input.executedBy,
      action: upstream.success
        ? 'TESTNET_EXECUTION_SUCCEEDED'
        : 'TESTNET_EXECUTION_FAILED',
      metadata: {
        ticketId: executed.id,
        upstreamStatusCode: upstream.statusCode,
        settlementTransaction: upstream.settlement?.transaction,
      },
    })

    return {
      success: upstream.success,
      request: finalRequest,
      ticket: executed,
      upstream: {
        statusCode: upstream.statusCode,
        responseHash: upstream.responseHash,
        responsePreview: upstream.responsePreview,
        paymentResponseHash: upstream.paymentResponseHash,
      },
      settlement: upstream.settlement,
      paymentSent: upstream.success,
    }
  } catch (error) {
    const executionError =
      error instanceof Error ? error.message : 'testnet_execution_failed'
    const finalRequest = await updatePublicBetaRequestExecution({
      id: request.id,
      status: 'EXECUTION_FAILED',
      executionError,
    })
    await auditPublicBetaRequestExecution({
      userId: request.userId,
      requestId: request.id,
      actorId: input.executedBy,
      action: 'TESTNET_EXECUTION_FAILED',
      metadata: { error: executionError },
    })
    throw Object.assign(new Error(executionError), {
      request: finalRequest,
    })
  }
}
