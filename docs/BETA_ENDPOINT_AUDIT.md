# Base Sepolia Endpoint Audit

Audit date: 2026-06-18

## Decision

**Conditionally approved for simulation and one future capped testnet payment.**

The War-Tracker event article endpoint returned a live x402 v2 HTTP 402
challenge containing a valid Base Sepolia payment option. It is suitable as the
first closed-beta candidate, but it is not approved for unattended or mainnet
execution.

No payment was sent during this audit. The check stopped after validating the
unauthenticated challenge, public service metadata, and health endpoint.

## Selected Candidate

| Field | Observed value |
| --- | --- |
| Service | War-Tracker Event Article |
| Method | `GET` |
| Resource | `https://war-tracker.com/share/397003/military-withdrawal-qasrak-syria` |
| Health | `GET https://war-tracker.com/healthz` returned HTTP 200 |
| Challenge | HTTP `402 Payment Required` |
| Protocol | x402 v2 |
| Payment header | `PAYMENT-REQUIRED` present |
| Scheme | `exact` |
| Network | `eip155:84532` (Base Sepolia) |
| Asset | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia USDC) |
| Amount | `2000` atomic units, or `0.002` USDC |
| Recipient | `0xF50C0D73C68EF2d8B3388Ec060ED39edCeb62BAF` |
| Timeout | 60 seconds |
| Response | HTML by default; JSON when `Accept: application/json` is sent |
| Contact | `sales@war-tracker.com` |

The challenge also advertises mainnet payment options. A future client must
select the requirement matching both `eip155:84532` and the Base Sepolia USDC
asset exactly. It must never select the first item blindly.

## Metadata Cross-Check

- PayAI Bazaar discovery listed the resource as x402 v2 on `eip155:84532`.
- The endpoint's live HTTP 402 challenge independently confirmed the same
  network and asset.
- `/healthz`, `/x402.json`, `/.well-known/api-catalog`, `/llms.txt`, and the
  OpenAPI document were reachable without payment.
- The Bazaar entry and live challenge agree on the Sepolia amount and
  recipient.

There is one material inconsistency: `/x402.json` presents Base mainnet as the
service's primary network and lists a `$0.001` route price, while the Sepolia
requirement advertised through PayAI is `0.002` USDC. Treat the live challenge
as authoritative for a request, and reject any requirement above the configured
`0.005` USDC beta cap.

## Expected Response Shape

With `Accept: application/json`, the service documents an event object with
fields including:

- event id and canonical URL
- date, event type, location, and country
- headline, summary, and article paragraphs
- confidence and media metadata
- schema.org JSON-LD graph

This shape was verified against the public OpenAPI and challenge metadata, not
through a paid response.

## Guardrails For The Next Phase

1. Keep `ALLOW_LIVE_EXECUTION=false` until the payment client is implemented.
2. Keep the public deployment and wallet isolated from the beta deployment.
3. Select only `exact` + `eip155:84532` + the audited USDC contract.
4. Require the quoted amount to be at most `0.005` USDC.
5. Verify the recipient and resource URL against this audit before signing.
6. Send `Accept: application/json` for the eventual test request.
7. Perform at most one manually approved testnet payment.
8. Record verification, settlement, response status, and payment reference.
9. Stop immediately if any network, asset, amount, recipient, or schema differs.

`EXECUTION_ENDPOINT_ALLOWLIST` remains empty for now because XoggAI does not yet
have a payment client or a seeded stable endpoint UUID for this resource.

## Rejected Alternative

`POST https://demo.aiapi.ch/v1/analyze` also returned a clean x402 v2 Base
Sepolia challenge using the correct USDC contract. Its quoted price was `0.01`
USDC, above the current `0.005` beta cap, so it was rejected for the first test.

## References

- x402 Foundation repository: https://github.com/x402-foundation/x402
- Bazaar discovery documentation: https://github.com/x402-foundation/x402/blob/main/docs/extensions/bazaar.mdx
- Network and token support: https://github.com/x402-foundation/x402/blob/main/docs/core-concepts/network-and-token-support.mdx
- x402.org facilitator support: https://www.x402.org/facilitator/supported
- Candidate payment policy: https://war-tracker.com/x402.json
- Candidate API catalog: https://war-tracker.com/.well-known/api-catalog
- Candidate OpenAPI: https://war-tracker.com/api/v1/openapi.json
