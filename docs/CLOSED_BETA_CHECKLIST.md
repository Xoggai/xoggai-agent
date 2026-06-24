# Closed Beta Checklist

Use this before enabling or expanding any XoggAI x402 execution path for a
limited tester group.

Public routing must stay dry-run first. The production public beta may execute
only through the controlled Base Sepolia path after every item below is
complete.

## Beta Scope

- Closed beta has a named owner.
- Closed beta has a fixed start date, end date, and tester list.
- Testers understand that XoggAI routes x402 API calls and that live execution can spend caller funds.
- Public website copy still says public preview and dry-run first.
- `ALLOW_LIVE_EXECUTION=false` remains set for public testnet beta and mainnet
  remains disabled.
- Policy simulation uses `EXECUTION_SIMULATION_ENABLED=true` without changing `ALLOW_LIVE_EXECUTION`.

## Environment

- Use a dedicated beta backend service or clearly isolated beta deployment.
- Use a dedicated beta frontend or hidden beta route if the public website stays dry-run only.
- Use dedicated beta database, Redis, and logs when possible.
- Confirm `ALLOWED_ORIGINS` only includes approved beta frontends.
- Confirm all secrets are stored in Render or the deployment provider, never committed.
- Confirm `BETA_EXECUTION_KEY` is only available to trusted server-side callers.
- Prefer one entry per tester or agent in `BETA_ACCESS_KEYS`.
- Confirm every beta profile has a unique id, revocable key, per-request budget,
  daily request quota, and daily budget quota.
- Confirm `EXECUTION_ENDPOINT_ALLOWLIST` contains only reviewed endpoint UUIDs.
- Start from `render.beta.yaml`; its allowlist is intentionally empty until a
  Base Sepolia endpoint passes `docs/BETA_ENDPOINT_AUDIT.md`.
- For dry-run or ticket rehearsal environments, confirm `/api/execution-status` reports:
  - `liveExecutionEnabled: false`
  - `paymentSigningEnabled: false`
  - `paymentSendingEnabled: false`
  - `safetyMode: dry-run-preview` or `ticket-rehearsal`
- For the production Base Sepolia public beta, confirm `/api/execution-status`
  reports:
  - `liveExecutionEnabled: false`
  - `network: base-sepolia`
  - `upstreamExecutionEnabled: true`
  - `paymentSigningEnabled: true`
  - `paymentVerificationEnabled: true`
  - `paymentSendingEnabled: true`

## Wallet And Payment Safety

- Use a dedicated beta wallet.
- Fund the wallet with a small capped amount only.
- Confirm the wallet private key is never exposed to the browser.
- Confirm the caller payment model is documented:
  - caller pays for API usage
  - XoggAI does not subsidize user API calls by default
  - dry-runs never send payment
- Define maximum payment per request.
- Define maximum payment per tester per day.
- Define maximum total beta spend.
- Define emergency wallet drain or key rotation procedure.

## Endpoint Allowlist

- Live execution only supports an explicit allowlist.
- Each allowed endpoint has:
  - name
  - URL
  - x402 price
  - expected response shape
  - max latency threshold
  - owner/contact
  - rollback decision
- Unknown endpoints stay dry-run only.
- Endpoint rating does not override allowlist restrictions.

## Request Guardrails

- Require beta authentication and a dedicated execution command for testnet
  execution.
- Require the ticket lifecycle before any Base Sepolia payment:
  - `PREPARED`
  - `APPROVED`
  - `CONSUMED`
- Require explicit budget input for live execution.
- Reject requests above the configured budget.
- Reject requests when endpoint price is missing or malformed.
- Reject requests when endpoint is not allowlisted.
- Reject requests when caller identity or beta access is missing.
- Rate limit live execution separately from dry-run routing.

## Logging And Observability

- Log every live attempt with:
  - request id
  - tester id or caller id
  - intent
  - selected endpoint id
  - quoted price
  - budget
  - payment verification result
  - settlement result
  - upstream status code
  - tx/payment reference when available
- Do not log private keys, bearer tokens, or full payment credentials.
- Render logs are checked after every beta run.
- Failed payment verification and settlement errors are visible in logs.
- `GET /api/beta/executions` returns only the requesting beta key's tickets.

## Test Matrix

- Dry-run route still works.
- Dry-run route never sends payment.
- Execution simulation passes while `ALLOW_LIVE_EXECUTION=false`.
- Execution simulation always returns `paymentSent: false`.
- `POST /execute/prepare` creates a `PREPARED` ticket and returns `paymentSent: false`.
- `POST /execute/approve` changes an unexpired ticket to `APPROVED` and returns `paymentSent: false`.
- `POST /execute/consume` changes an approved ticket to `CONSUMED` and returns `paymentSent: false`.
- Optional `POST /execute/sign` accepts only an unexpired `CONSUMED` ticket,
  changes it to `SIGNED`, and still returns `paymentSent: false`.
- Signing is restricted to Base Sepolia and an isolated testnet wallet.
- PostgreSQL stores only the signature hash, never the full credential.
- Optional `POST /execute/verify` binds the credential to its `SIGNED` ticket
  before calling the audited facilitator.
- Verify-only responses always report `paymentSettled: false` and
  `paymentSent: false`.
- A facilitator `INVALID` result records the rejection reason without calling
  settlement.
- Standalone settlement remains disabled in production public beta; audited
  upstream execution may return settlement metadata from the x402 resource.
- Settlement requires explicit confirmation and a `VERIFIED` ticket.
- Ticket state moves atomically to `SETTLING` before the facilitator call.
- Settlement amount cannot exceed `0.005 USDC`.
- Unknown settlement results are never retried automatically.
- Unknown upstream execution results are never retried automatically.
- Upstream execution uses only the audited Base Sepolia resource and records
  response hashes instead of logging full payloads.
- Expired, consumed, missing, or wrong-status tickets are rejected.
- In rehearsal mode, `/api/execution-status` shows payment signing and sending
  disabled.
- In production Base Sepolia public beta, `/api/execution-status` shows payment
  signing, verification, and sending enabled while `ALLOW_LIVE_EXECUTION=false`.
- Mainnet/public direct live execution is blocked when
  `ALLOW_LIVE_EXECUTION=false`; production testnet execution uses the separate
  operator-approved Base Sepolia upstream path.
- Live execution is blocked for non-beta callers.
- Live execution is blocked for non-allowlisted endpoints.
- Live execution is blocked when budget is below endpoint price.
- Live execution succeeds for one approved endpoint with a low budget.
- Upstream API failure returns a clear error and does not retry uncontrolled.
- Settlement failure returns a clear error.
- Rate limit blocks repeated calls.

## Rollback Plan

- Set `ALLOW_LIVE_EXECUTION=false`.
- Set `X402_PREPARE_ENABLED=false`.
- Set `X402_SIGNING_ENABLED=false`.
- Set `X402_VERIFY_ENABLED=false`.
- Set `X402_SETTLEMENT_ENABLED=false`.
- Set `X402_UPSTREAM_EXECUTION_ENABLED=false`.
- Remove beta frontend origin from `ALLOWED_ORIGINS`.
- Remove endpoint allowlist entries.
- Rotate beta wallet key if needed.
- Pause Render service if an unsafe payment path is observed.
- Post an internal incident note with request ids and timeline.

## Exit Criteria

Closed beta can move toward or remain in public testnet beta only when:

- Live execution has completed successfully on an allowlisted endpoint.
- Ticket rehearsal completed from prepare to approve to consume without payment.
- Spend limits were enforced.
- Dry-run behavior remained unchanged.
- Error handling was clear to testers.
- No private keys, API keys, or payment credentials appeared in logs.
- Tester feedback confirms the execution flow is understandable.
