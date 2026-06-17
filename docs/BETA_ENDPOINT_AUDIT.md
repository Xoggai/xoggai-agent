# Base Sepolia Endpoint Audit

Audit date: 2026-06-18

## Decision

**Approved for prepare-only simulation. A future capped testnet payment still
requires separate manual approval.**

The Node4All sandbox endpoint returned a live x402 v2 HTTP 402 challenge with
one exact Base Sepolia USDC requirement. It is suitable as the first
closed-beta candidate, but it is not approved for unattended or mainnet
execution.

No payment was sent during this audit. The check stopped after validating the
unauthenticated challenge and public discovery metadata.

## Selected Candidate

| Field | Observed value |
| --- | --- |
| Service | Node4All Fortune |
| Method | `GET` |
| Resource | `https://sandbox.node4all.com/v1/x402-test?host=sandbox.node4all.com` |
| Challenge | HTTP `402 Payment Required` |
| Protocol | x402 v2 |
| Payment header | `PAYMENT-REQUIRED` present |
| Scheme | `exact` |
| Network | `eip155:84532` (Base Sepolia) |
| Asset | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia USDC) |
| Amount | `2000` atomic units, or `0.002` USDC |
| Recipient | `0xd275612Bf0BB35638432c4D95eAA8D5d22346Ca6` |
| Timeout | 60 seconds |
| Response | JSON |

The client still selects the requirement by exact scheme, network, and asset;
it never trusts array ordering.

## Metadata Cross-Check

- Coinbase CDP discovery listed the resource as x402 v2 on `eip155:84532`.
- The endpoint's live HTTP 402 challenge independently confirmed the same
  network, asset, amount, recipient, and timeout.
- Discovery reports recent calls and multiple unique payers, but this is only
  supporting metadata. The live challenge remains authoritative.
- The canonical challenge resource includes the `host` query parameter. The
  client pins that complete URL and rejects any difference.

## Expected Response Shape

The discovery schema documents a JSON fortune object with fields including:

- service and endpoint identifiers
- x402 protocol and network labels
- fortune text
- lucky number and color
- energy label

This shape was verified against public discovery and challenge metadata, not
through a paid response.

## Guardrails For The Next Phase

1. Keep `ALLOW_LIVE_EXECUTION=false` until the payment client is implemented.
2. Keep the public deployment and wallet isolated from the beta deployment.
3. Select only `exact` + `eip155:84532` + the audited USDC contract.
4. Require the quoted amount to be at most `0.005` USDC.
5. Verify the recipient and resource URL against this audit before signing.
6. Send `Accept: application/json` for the eventual test request.
7. Perform at most one separately approved testnet payment.
8. Record verification, settlement, response status, and payment reference.
9. Stop immediately if any network, asset, amount, recipient, or schema differs.

`EXECUTION_ENDPOINT_ALLOWLIST` remains empty for now because XoggAI does not yet
have a payment client or a seeded stable endpoint UUID for this resource.

The prepare-only implementation pins these values in
`src/config/auditedX402.ts`. `POST /execute/prepare` may fetch and validate the
unpaid challenge when explicitly enabled, but it contains no signing or payment
submission code.

## Rejected Alternative

The former War-Tracker candidate was removed after its live challenge stopped
advertising Base Sepolia, despite stale discovery metadata claiming otherwise.
The fail-closed preview client rejected it as
`unsupported_payment_requirement`.

`POST https://demo.aiapi.ch/v1/analyze` returned a clean x402 v2 Base Sepolia
challenge using the correct USDC contract, but its `0.01` USDC price exceeds the
current `0.005` beta cap.

## References

- x402 Foundation repository: https://github.com/x402-foundation/x402
- Coinbase CDP discovery API: https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
- Network and token support: https://github.com/x402-foundation/x402/blob/main/docs/core-concepts/network-and-token-support.mdx
- x402.org facilitator support: https://www.x402.org/facilitator/supported
- Candidate resource: https://sandbox.node4all.com/v1/x402-test?host=sandbox.node4all.com
