# Closed Beta Checklist

Use this before enabling any XoggAI live x402 execution path for a limited tester group.

Public preview must stay dry-run first until every item below is complete.

## Beta Scope

- Closed beta has a named owner.
- Closed beta has a fixed start date, end date, and tester list.
- Testers understand that XoggAI routes x402 API calls and that live execution can spend caller funds.
- Public website copy still says public preview and dry-run first.
- `ALLOW_LIVE_EXECUTION=false` remains set for the public demo until a separate beta environment is ready.
- Policy simulation uses `EXECUTION_SIMULATION_ENABLED=true` without changing `ALLOW_LIVE_EXECUTION`.

## Environment

- Use a dedicated beta backend service or clearly isolated beta deployment.
- Use a dedicated beta frontend or hidden beta route if the public website stays dry-run only.
- Use dedicated beta database, Redis, and logs when possible.
- Confirm `ALLOWED_ORIGINS` only includes approved beta frontends.
- Confirm all secrets are stored in Render or the deployment provider, never committed.
- Confirm `BETA_EXECUTION_KEY` is only available to trusted server-side callers.
- Confirm `EXECUTION_ENDPOINT_ALLOWLIST` contains only reviewed endpoint UUIDs.
- Start from `render.beta.yaml`; its allowlist is intentionally empty until a
  Base Sepolia endpoint passes `docs/BETA_ENDPOINT_AUDIT.md`.
- Confirm `/api/execution-status` reports:
  - `liveExecutionEnabled: false`
  - `paymentSigningEnabled: false`
  - `paymentSendingEnabled: false`
  - `safetyMode: dry-run-preview` or `ticket-rehearsal`

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

- Require `dry=false` or a dedicated live execution command for beta execution.
- Require the ticket lifecycle before any future live payment:
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

## Test Matrix

- Dry-run route still works.
- Dry-run route never sends payment.
- Execution simulation passes while `ALLOW_LIVE_EXECUTION=false`.
- Execution simulation always returns `paymentSent: false`.
- `POST /execute/prepare` creates a `PREPARED` ticket and returns `paymentSent: false`.
- `POST /execute/approve` changes an unexpired ticket to `APPROVED` and returns `paymentSent: false`.
- `POST /execute/consume` changes an approved ticket to `CONSUMED` and returns `paymentSent: false`.
- Expired, consumed, missing, or wrong-status tickets are rejected.
- `/api/execution-status` shows payment signing and sending disabled.
- Live execution is blocked when `ALLOW_LIVE_EXECUTION=false`.
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
- Remove beta frontend origin from `ALLOWED_ORIGINS`.
- Remove endpoint allowlist entries.
- Rotate beta wallet key if needed.
- Pause Render service if an unsafe payment path is observed.
- Post an internal incident note with request ids and timeline.

## Exit Criteria

Closed beta can move toward public beta only when:

- Live execution has completed successfully on an allowlisted endpoint.
- Ticket rehearsal completed from prepare to approve to consume without payment.
- Spend limits were enforced.
- Dry-run behavior remained unchanged.
- Error handling was clear to testers.
- No private keys, API keys, or payment credentials appeared in logs.
- Tester feedback confirms the execution flow is understandable.
