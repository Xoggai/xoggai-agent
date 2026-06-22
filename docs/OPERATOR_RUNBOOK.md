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

## Rollback

- Keep `ALLOW_LIVE_EXECUTION=false`.
- Set `X402_PREPARE_ENABLED=false` to stop ticket rehearsal.
- Set `X402_SIGNING_ENABLED=false` to stop credential creation immediately.
- Rotate `BETA_EXECUTION_KEY` if it was exposed.
- Remove beta origins from `ALLOWED_ORIGINS` if needed.
- Pause the beta backend if ticket state changes unexpectedly.
