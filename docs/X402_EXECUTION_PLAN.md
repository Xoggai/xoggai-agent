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
| `simulation` | none | live now | Shows what live execution would require. |
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

Suggested beta endpoint:

```http
POST /execute
Content-Type: application/json
```

Request shape:

```json
{
  "intent": "what is the ETH price?",
  "endpointId": "market-data-eth-price",
  "budget": 0.05,
  "dry": false
}
```

Response shape:

```json
{
  "success": true,
  "mode": "beta-live",
  "intent": "what is the ETH price?",
  "endpoint": {
    "id": "market-data-eth-price",
    "name": "Market Data ETH Price",
    "url": "https://example.com/x402/price"
  },
  "payment": {
    "verified": true,
    "settled": true,
    "amount": 0.01,
    "network": "base-mainnet",
    "reference": "TODO"
  },
  "result": {}
}
```

## Guardrails

- Keep dry-run as the default.
- Require explicit live mode for any payment path.
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

