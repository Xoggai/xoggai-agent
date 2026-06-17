# Beta Endpoint Audit

Audit date: 2026-06-18

## Decision

**Not approved for the Base Sepolia closed-beta allowlist.**

The CoinGecko Simple Price endpoint is a real, reachable x402 v2 resource, but
its observed EVM payment option is Base mainnet. The closed-beta template uses
Base Sepolia, so enabling this endpoint would create a network mismatch.

No payment was sent during this audit. The check stopped at the unauthenticated
HTTP 402 response.

## Candidate

| Field | Observed value |
| --- | --- |
| Name | CoinGecko Simple Price |
| Request | `GET https://pro-api.coingecko.com/api/v3/x402/simple/price?ids=ethereum&vs_currencies=usd` |
| Response | `402 Payment Required` |
| Protocol | x402 v2 |
| Payment header | `PAYMENT-REQUIRED` present |
| Scheme | `exact` |
| EVM network | `eip155:8453` (Base mainnet) |
| Asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base USDC) |
| Amount | `10000` atomic units, or `0.01` USDC |
| Timeout | 60 seconds |
| Response type | JSON |

The payment requirement also advertised a Solana option. Neither advertised
option is Base Sepolia (`eip155:84532`).

## Expected Response Shape

The endpoint's Bazaar metadata describes a JSON object keyed by coin ID. The
coin value includes fields such as USD price and optional market data selected
by query parameters. This shape was read from the unpaid x402 metadata and was
not verified through a paid request.

## Safety Decision

- Keep `EXECUTION_ENDPOINT_ALLOWLIST` empty in `render.beta.yaml`.
- Keep `ALLOW_LIVE_EXECUTION=false`.
- Permit route policy simulation only; it never calls the upstream endpoint.
- Re-audit if the endpoint advertises `eip155:84532` or a separate Base Sepolia
  test resource becomes available.
- Disable the candidate immediately if its price, asset, network, recipient, or
  response contract changes.

## Acceptance Criteria For A Replacement

A beta endpoint can be allowlisted only after all of these are observed:

1. HTTP 402 with an x402 v2 `PAYMENT-REQUIRED` header.
2. `exact` scheme on `eip155:84532`.
3. Base Sepolia USDC asset `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
4. Price at or below `0.005` USDC per request.
5. Stable JSON response schema and an identifiable operator/contact.
6. One capped testnet payment followed by verification and settlement logs.

## Protocol References

- x402 Foundation repository: https://github.com/x402-foundation/x402
- Network and token support: https://github.com/x402-foundation/x402/blob/main/docs/core-concepts/network-and-token-support.mdx
- Facilitator guidance: https://github.com/x402-foundation/x402/blob/main/docs/dev-tools/facilitators.md
