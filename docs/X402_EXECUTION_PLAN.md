# X402 Execution Plan

This plan describes the intended path from XoggAI dry-run routing to controlled x402 live execution.

The public product remains dry-run first. Live paid execution should only be enabled after the closed beta checklist is satisfied.

## Current Public Flow

```text
agent intent
-> GET /intent?q=<intent>&dry=true
-> XoggAI ranks x402 endpoints
-> backend returns endpoint preview
-> no payment is sent
```

## Target Closed Beta Flow

```text
agent intent
-> dry-run route preview
-> caller confirms endpoint and budget
-> backend validates beta access
-> backend validates endpoint allowlist
-> backend builds x402 payment request
-> facilitator verifies payment
-> backend calls upstream x402 API
-> facilitator settles payment
-> backend returns API result plus payment metadata
```

## Execution States

| State | Payment | Public availability | Notes |
| --- | --- | --- | --- |
| `dry-run` | none | live now | Default public mode. |
| `simulation` | none | closed beta | Shows what live execution would require. |
| `beta-live` | caller funded | closed beta only | Requires allowlist, budget, logs, and explicit beta access. |
| `public-live` | caller funded | not enabled | Requires more testing and public docs. |

## Required Inputs

Live execution must not start without:

- `intent`
- `endpointId` or selected route from a fresh dry-run
- `budget`
- caller or beta tester identity
- explicit live execution flag
- endpoint allowlist match
- configured x402 network
- configured wallet/payment path

## Backend Contract

The first implementation of the beta endpoint is policy simulation only:

```http
POST /execute
Content-Type: application/json
```

Request shape:

```json
{
  "intent": "what is the ETH price?",
  "endpointId": "11111111-1111-4111-8111-111111111111",
  "budget": 0.05,
  "mode": "simulation"
}
```

It requires an `x-beta-key` header, checks the endpoint allowlist and budget
limits, and returns `paymentSent: false`. It does not import the x402 payment
handler or call the selected upstream API.

Simulation uses `EXECUTION_SIMULATION_ENABLED=true`. This is independent from
`ALLOW_LIVE_EXECUTION`, which must remain `false` until a real payment path is
implemented and separately audited.
The backend currently refuses to start if `ALLOW_LIVE_EXECUTION=true`.

Challenge inspection is a separate prepare-only stage. When
`X402_PREPARE_ENABLED=true`, `POST /execute/prepare` fetches the pinned audited
resource without payment credentials and validates its HTTP 402 requirement.
It then stores a short-lived approval ticket with status `PREPARED`. It does
not sign or submit a payment.

Operators can inspect this stage with `npm run test:x402-prepare`. The command
accepts only HTTPS backends (except localhost), caps its requested budget at
`0.005` USDC, and fails unless the response explicitly confirms that no
signature or payment was created.

Prepare response shape:

```json
{
  "success": true,
  "mode": "prepare-only",
  "requestId": "prepared-request-id",
  "budgetUsdc": 0.005,
  "paymentPrepared": true,
  "paymentSigned": false,
  "paymentSent": false,
  "ticket": {
    "id": "11111111-1111-4111-8111-111111111111",
    "status": "PREPARED",
    "challengeHash": "sha256-of-payment-required-header",
    "expiresAt": "2026-06-20T12:01:00.000Z"
  }
}
```

The ticket is an approval artifact, not payment authorization. Future live
execution must require an unexpired, manually approved, one-time ticket before
any wallet signing path is allowed.

Ticket approval is also server-side only:

```http
POST /execute/approve
Content-Type: application/json
x-beta-key: <operator-secret>
```

```json
{
  "ticketId": "11111111-1111-4111-8111-111111111111",
  "approvedBy": "operator"
}
```

Approval changes an unexpired ticket from `PREPARED` to `APPROVED`. It still
returns `paymentSigned=false` and `paymentSent=false`. Expired, consumed,
missing, already approved, or non-prepared tickets are rejected.

Call this endpoint from a trusted server or agent runtime. Never embed the beta
key in the public website or other browser-delivered code. `GET /intent` stays
routing-only and rejects `dry=false`.

Simulation response shape:

```json
{
  "success": true,
  "mode": "simulation",
  "intent": "what is the ETH price?",
  "endpoint": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Market Data ETH Price",
    "url": "https://example.com/x402/price"
  },
  "simulationPassed": true,
  "liveExecutionEnabled": false,
  "blockedBy": [],
  "paymentSent": false
}
```

Live execution remains a later phase and must use a separate code path after
the simulation policy has been verified in closed beta.

Run the server-side simulation check with:

```powershell
$env:XOGGAI_API_BASE='http://localhost:3000'
$env:BETA_EXECUTION_KEY='<at-least-32-characters>'
$env:TEST_ENDPOINT_ID='<allowlisted-endpoint-uuid>'
npm run test:execution-simulation
```

## Guardrails

- Keep dry-run as the default.
- Require explicit live mode for any payment path.
- Require a fresh approval ticket before any future live payment.
- Treat prepare tickets as one-time-use records.
- Keep approval server-side; never expose approval keys in browser code.
- Block live execution when `ALLOW_LIVE_EXECUTION=false`.
- Block live execution for unknown endpoints.
- Block live execution when budget is missing.
- Block live execution when price exceeds budget.
- Block live execution when beta access is missing.
- Never expose wallet private keys to the browser.
- Never log secrets or raw payment credentials.

## Facilitator Flow

The implementation should use the x402 facilitator path for payment verification and settlement.

High-level sequence:

```text
1. Select endpoint from dry-run route.
2. Validate live execution guardrails.
3. Build payment requirement for the selected x402 endpoint.
4. Verify payment with facilitator.
5. Call upstream endpoint only after verification succeeds.
6. Settle payment with facilitator.
7. Return upstream result and payment metadata.
```

If verification fails, do not call the upstream API.

If upstream execution fails, return the upstream error and record payment state.

If settlement fails, return a clear settlement error and log the request id for follow-up.

## Observability

Every live execution attempt needs a request id.

Log:

- request id
- mode
- caller or tester id
- intent
- endpoint id
- endpoint price
- budget
- verification status
- upstream status
- settlement status
- payment reference
- elapsed time

Do not log:

- private keys
- API keys
- bearer tokens
- full payment credentials

## Public Messaging

Use this wording until public live execution is actually enabled:

- `Public preview is dry-run first.`
- `Live execution is gated.`
- `No payment is sent by default.`
- `Closed beta execution requires explicit wallet and budget controls.`

Avoid:

- `fully live x402 execution`
- `autonomous paid execution is public`
- `XoggAI pays for user API calls`
