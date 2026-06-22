# Operator Runbook

Use this runbook for XoggAI closed-beta execution rehearsals.

This flow does not sign a payment and does not send payment. It validates the
audited x402 challenge, creates an approval ticket, approves it, then consumes
it as a one-time-use checkpoint for future live execution.

An optional final testnet step can create a payment credential after
consumption. It still does not send the paid request.

## Required Access

- Backend URL in `XOGGAI_API_BASE`.
- Server-side `BETA_EXECUTION_KEY`.
- `X402_PREPARE_ENABLED=true` on the beta backend.
- `ALLOW_LIVE_EXECUTION=false`.
- `X402_SIGNING_ENABLED=false` unless the isolated signing step is intended.
- `X402_VERIFY_ENABLED=false` unless verify-only rehearsal is intended.
- `X402_SETTLEMENT_ENABLED=false` unless one funded testnet payment is
  explicitly scheduled.
- `X402_UPSTREAM_EXECUTION_ENABLED=false` unless one funded audited upstream
  resource call is explicitly scheduled.
- No browser-delivered code may include `BETA_EXECUTION_KEY`.

## Safety Check

Before every rehearsal:

```powershell
npm run x402:operator -- status
```

Expected:

```json
{
  "safetyMode": "dry-run-preview",
  "liveExecutionEnabled": false,
  "paymentSigningEnabled": false,
  "paymentSendingEnabled": false
}
```

Stop if `liveExecutionEnabled`, `paymentSigningEnabled`, or
`paymentSendingEnabled` is `true`.

## 1. Prepare

Prepare fetches the audited x402 endpoint without payment credentials and
stores a short-lived `PREPARED` ticket.

```powershell
$env:TEST_X402_BUDGET='0.005'
npm run x402:operator -- prepare
```

Expected:

- `mode: prepare-only`
- `paymentPrepared: true`
- `paymentSigned: false`
- `paymentSent: false`
- ticket status is `PREPARED`
- amount, network, asset, recipient, and resource URL match the audit file

Record:

- ticket id
- challenge hash
- amount
- resource URL
- expiry

## 2. Approve

Approve only after the prepared ticket details match the audit.

```powershell
$env:X402_OPERATOR='operator'
npm run x402:operator -- approve <prepared-ticket-id>
```

Expected:

- `mode: approval-only`
- `paymentApproved: true`
- ticket status is `APPROVED`
- `paymentSigned: false`
- `paymentSent: false`

Do not approve if the ticket is expired, unexpected, or missing audit context.

## 3. Consume

Consume marks the approved ticket as used. This is the dry handoff point that
future live execution must pass before wallet signing exists.

```powershell
$env:X402_OPERATOR='operator'
npm run x402:operator -- consume <approved-ticket-id>
```

Expected:

- `mode: consume-only`
- `paymentConsumed: true`
- ticket status is `CONSUMED`
- `paymentSigned: false`
- `paymentSent: false`

Reject any attempt to consume a non-approved, expired, missing, or already
consumed ticket.

## 4. Sign (Optional Testnet Rehearsal)

Enable only on an isolated Base Sepolia backend with a disposable test wallet:

```powershell
$env:X402_SIGNING_ENABLED='true'
npm run x402:operator -- sign <consumed-ticket-id>
```

Expected:

- `mode: sign-only`
- ticket status is `SIGNED`
- `paymentSigned: true`
- `paymentSent: false`
- signer address matches the configured testnet wallet
- signature is redacted from normal CLI output

The credential is an EIP-3009 authorization and must be treated as sensitive.
The backend stores only its SHA-256 signature hash and audit metadata. It does
not call the paid resource, facilitator verify/settle endpoints, or an RPC
broadcast method.

## 5. Verify (No Settlement)

The recommended operator command signs and verifies in one process so the full
credential is never persisted or printed:

```powershell
$env:X402_SIGNING_ENABLED='true'
$env:X402_VERIFY_ENABLED='true'
npm run x402:operator -- sign-verify <consumed-ticket-id>
```

Expected:

- `mode: sign-verify`
- `paymentSigned: true`
- `paymentSettled: false`
- `paymentSent: false`
- verification status is `VALID` or `INVALID`
- facilitator URL is `https://x402.org/facilitator`

`INVALID` is expected when the isolated wallet lacks sufficient Base Sepolia
USDC or another facilitator policy check fails. The result is still recorded
with its reason and hash. No settlement request is made.

## 6. Settle One Funded Testnet Payment

Prerequisites:

- dedicated Base Sepolia wallet
- wallet address matches the configured private key
- enough Base Sepolia USDC for one payment plus a small buffer
- `MAX_EXECUTION_BUDGET_USDC=0.005` or lower
- `X402_SETTLEMENT_ENABLED=true`
- an unexpired `CONSUMED` ticket

Run:

```powershell
$env:X402_CONFIRM_SETTLEMENT='SETTLE_BASE_SEPOLIA'
npm run x402:operator -- sign-verify-settle <consumed-ticket-id>
```

The command stops before settlement unless facilitator verification returns
`isValid: true`. A successful result must include:

- ticket status `SETTLED`
- `paymentSigned: true`
- `paymentVerified: true`
- `paymentSettled: true`
- `paymentSent: true`
- Base Sepolia transaction hash

After the first successful payment, immediately set
`X402_SETTLEMENT_ENABLED=false` and record the transaction in the beta report.

Do not retry a ticket with status `SETTLING`, `SETTLED`,
`SETTLEMENT_FAILED`, or `SETTLEMENT_UNKNOWN`. An unknown result requires manual
facilitator and chain inspection because the payment may have settled even
when the client timed out.

## 7. Execute One Audited Upstream Resource

This is the first end-to-end paid API rehearsal. It does not use the standalone
settlement route. Instead, it signs a consumed ticket, verifies it with the
facilitator, then sends the payment credential to the audited x402 resource via
the v2 `PAYMENT-SIGNATURE` header. The resource returns `PAYMENT-RESPONSE`,
which is stored as the settlement audit reference.

Prerequisites:

- dedicated Base Sepolia wallet
- wallet address matches the configured private key
- enough Base Sepolia USDC for one payment plus a small buffer
- `MAX_EXECUTION_BUDGET_USDC=0.005` or lower
- `X402_UPSTREAM_EXECUTION_ENABLED=true`
- `X402_SETTLEMENT_ENABLED=false`
- an unexpired `CONSUMED` ticket

Run:

```powershell
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run x402:operator -- sign-verify-execute <consumed-ticket-id>
```

A successful result must include:

- ticket status `EXECUTED`
- `paymentSigned: true`
- `paymentVerified: true`
- `paymentSent: true`
- upstream HTTP status
- upstream response hash
- Base Sepolia transaction hash from `PAYMENT-RESPONSE`

After the first successful execution, immediately set
`X402_UPSTREAM_EXECUTION_ENABLED=false` and record the request id, transaction,
response hash, and operator.

Do not retry a ticket with status `UPSTREAM_EXECUTING`, `EXECUTED`,
`UPSTREAM_FAILED`, or `UPSTREAM_UNKNOWN`.

## Error Handling

- `invalid_beta_access`: stop and rotate/check the beta key.
- `payment_prepare_disabled`: beta backend is not configured for ticket rehearsal.
- `payment_ticket_not_found`: ticket id is wrong or belongs to another database.
- `payment_ticket_expired`: start again from prepare.
- `payment_ticket_already_approved`: do not approve again.
- `payment_ticket_consumed`: do not reuse the ticket.
- `payment_ticket_not_approved`: approve first, then consume.
- `payment_ticket_not_consumed`: consume first, then sign.
- `payment_ticket_already_signed`: do not sign the ticket again.
- `payment_ticket_missing_signing_metadata`: prepare a new ticket.
- `payment_signing_disabled`: enable signing only on the isolated testnet
  backend.
- `payment_verification_disabled`: enable verification only on the isolated
  testnet backend.
- `verification_payload_mismatch`: discard the credential and start from a new
  prepare ticket.
- `verification_signature_mismatch`: the credential does not match the stored
  signing audit hash.
- `payment_settlement_disabled`: settlement flag is off.
- `settlement_confirmation_required`: explicit local confirmation is missing.
- `settlement_budget_exceeded`: amount exceeds the hard beta cap.
- `payment_ticket_already_settling`: another settlement request owns the
  ticket.
- `settlement_result_unknown`: inspect facilitator and chain state manually;
  never retry automatically.
- `upstream_execution_disabled`: upstream paid execution flag is off.
- `upstream_execution_confirmation_required`: explicit local confirmation is
  missing.
- `upstream_payment_response_missing`: the upstream resource responded without
  the expected x402 settlement response header.
- `upstream_execution_result_unknown`: inspect upstream logs and chain state
  manually; never retry automatically.

## Rollback

- Keep `ALLOW_LIVE_EXECUTION=false`.
- Set `X402_PREPARE_ENABLED=false` to stop ticket rehearsal.
- Set `X402_SIGNING_ENABLED=false` to stop credential creation immediately.
- Set `X402_VERIFY_ENABLED=false` to stop facilitator verification.
- Set `X402_SETTLEMENT_ENABLED=false` to stop funded payments immediately.
- Set `X402_UPSTREAM_EXECUTION_ENABLED=false` to stop paid upstream calls
  immediately.
- Rotate `BETA_EXECUTION_KEY` if it was exposed.
- Remove beta origins from `ALLOWED_ORIGINS` if needed.
- Pause the beta backend if ticket state changes unexpectedly.
