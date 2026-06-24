<p align="center">
  <img src="frontend/assets/xoggai-logo.png" alt="XoggAI" width="96"/>
</p>

<h1 align="center">XoggAI</h1>

<p align="center">
  Intelligence becomes action.
</p>

<p align="center">
  <a href="https://xoggai-agent.com"><img alt="Website" src="https://img.shields.io/badge/website-live-7cffb2?style=flat-square&labelColor=06150d"></a>
  <a href="https://xoggai-agent.com/docs"><img alt="Docs" src="https://img.shields.io/badge/docs-agent%20files-46e3c0?style=flat-square&labelColor=06150d"></a>
  <a href="https://xoggai-backend.onrender.com"><img alt="Backend" src="https://img.shields.io/badge/backend-render-9fb7a8?style=flat-square&labelColor=06150d"></a>
  <a href="https://xoggai-agent.com"><img alt="Mode" src="https://img.shields.io/badge/mode-testnet%20beta-f7fbf6?style=flat-square&labelColor=06150d"></a>
</p>

XoggAI is a production-grade testnet beta intent router for AI agents and x402 APIs.

Agents send a plain-English intent, inspect ranked endpoint previews, and route approved beta requests through a guarded Base Sepolia x402 execution path.

**Live product:** https://xoggai-agent.com  
**Docs UI:** https://xoggai-agent.com/docs  
**Backend API:** https://xoggai-backend.onrender.com

![XoggAI public preview](docs/assets/xoggai-preview.png)

## Product

AI agents should not execute blindly.

XoggAI gives agents a routing layer between natural-language intent and x402 API execution:

```text
intent
-> ranked x402 endpoint preview
-> route metadata
-> explicit execution decision
```

The public product is live as a production-grade testnet beta. The default user flow starts with dry-run routing, then approved requests can execute through the gated Base Sepolia x402 path. Mainnet remains disabled.

## Live Preview

- Website: https://xoggai-agent.com
- Terminal demo: https://xoggai-agent.com/
- Docs UI: https://xoggai-agent.com/docs
- Developer kit: https://xoggai-agent.com/connect-agent/
- OpenAPI: https://xoggai-agent.com/openapi.json
- Agent skill: https://xoggai-agent.com/skill.md
- LLM context: https://xoggai-agent.com/llms.txt

## What Connect Agent Means

Connect Agent means connecting an existing agent to XoggAI routing.

It does not deploy a new agent, and it does not make XoggAI pay for the user's API calls.

Typical flow:

```text
existing agent
-> XoggAI /intent?q=...
-> ranked x402 endpoint preview
-> developer/agent decides whether to execute later
```

## Public Preview Boundary

- Live today: frontend, backend, beta console, operator console, docs UI, endpoint previews, and gated Base Sepolia execution.
- Default mode: dry-run routing before execution.
- Public beta execution: operator-approved Base Sepolia x402 only.
- Safe by default: no mainnet payment and no browser wallet secrets.
- Not public yet: self-serve mainnet paid execution.
- Future mainnet execution requires explicit wallet and budget controls.

## How It Works

1. Agent sends a natural-language intent.
2. XoggAI embeds/searches/ranks matching x402 API endpoints.
3. XoggAI returns endpoint metadata in dry-run mode.
4. The caller sees price, latency, rating, URL, and schema before execution.
5. Controlled testnet execution requires beta access, operator approval, request expiry, budget caps, and an allowlisted Base Sepolia endpoint.

## Architecture

```text
frontend terminal/docs
-> backend intent router
-> endpoint index + rating engine
-> dry-run preview response
-> controlled operator-approved Base Sepolia execution path
```

## Public API

Production base URL:

```text
https://xoggai-backend.onrender.com
```

Common endpoints:

```http
GET /
GET /health
GET /api/info
GET /api/execution-status
GET /intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true
GET /search?q=crypto%20price&limit=5&dry=true
GET /api/stats
GET /api/feed
GET /api/endpoints
```

Minimal agent snippet:

```ts
const XOGGAI_API = 'https://xoggai-backend.onrender.com';

export async function routeIntent(intent: string, budget = 0.005) {
  const url = new URL(`${XOGGAI_API}/intent`);
  url.searchParams.set('q', intent);
  url.searchParams.set('budget', String(budget));
  url.searchParams.set('dry', 'true');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`XoggAI route failed: ${res.status}`);
  return res.json();
}
```

## Quick Test

```powershell
curl.exe https://xoggai-backend.onrender.com/health
curl.exe "https://xoggai-backend.onrender.com/intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true"
```

Expected behavior: dry-run responses only. Public demos do not send payment.

## Terminal Commands

The website terminal is a live dry-run console.

```text
help
connect
status
health
stats
endpoints
price eth
explain what is the ETH price?
simulate payment
search crypto price
route what is the ETH price?
docs
openapi
clear
```

## Local Development

Install dependencies:

```powershell
npm install
```

Start local Postgres and Redis:

```powershell
docker compose up -d db redis
```

Prepare the local database:

```powershell
npm run db:local:init
npm run seed
```

Run the backend:

```powershell
npm run dev
```

Serve the frontend:

```powershell
npm run frontend:serve
```

## Docker

To run the full local stack in Docker, fill `.env` from `.env.example`, then run:

```powershell
docker compose up --build
```

The `app` service runs migration and seed before starting the API.

## Deployment

Frontend:

- Netlify
- `netlify.toml` publishes `frontend/`

Backend:

- Render Blueprint
- `render.yaml` creates `xoggai-backend`, Postgres, and Redis-compatible key/value service

Important Render environment variables:

```text
ALLOWED_ORIGINS=https://xoggai-agent.com,https://www.xoggai-agent.com,https://your-netlify-site.netlify.app
ANTHROPIC_API_KEY=sk-ant-or-router-key
ANTHROPIC_BASE_URL=https://your-anthropic-compatible-router.example.com
ANTHROPIC_ROUTER_MODEL=claude-sonnet-4-5
ANTHROPIC_RATING_MODEL=claude-haiku-4-5-20251001
X402_WALLET_PRIVATE_KEY=0x...
X402_WALLET_ADDRESS=0x...
ALLOW_LIVE_EXECUTION=false
EXECUTION_SIMULATION_ENABLED=false
X402_NETWORK=base-sepolia
X402_PREPARE_ENABLED=true
X402_SIGNING_ENABLED=true
X402_VERIFY_ENABLED=true
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=true
X402_FACILITATOR_URL=https://x402.org/facilitator
BETA_EXECUTION_KEY=<server-side-secret-at-least-32-characters>
MAX_EXECUTION_BUDGET_USDC=0.005
EXECUTION_ENDPOINT_ALLOWLIST=<comma-separated-endpoint-uuids>
```

Keep `ALLOW_LIVE_EXECUTION=false` for public demos.

Before pushing production-facing changes, run:

```powershell
npm test
npm audit --omit=dev
npm run production:check
git diff --check
```

Before public testnet launch checks, run:

```powershell
npm run phase14:qa
```

For an isolated Base Sepolia beta environment, review
[`render.beta.yaml`](render.beta.yaml) and
[`docs/BETA_ENDPOINT_AUDIT.md`](docs/BETA_ENDPOINT_AUDIT.md). The beta template
ships with an empty endpoint allowlist by design. Production testnet execution
is enabled only after the intended endpoint is explicitly allowlisted.
When `X402_PREPARE_ENABLED=true`, `POST /execute/prepare` can fetch and validate
the audited endpoint's unpaid 402 challenge and store a short-lived
`PREPARED` approval ticket. This prepare-only route never creates a signature,
retries with payment credentials, or sends a transaction.
The backend still refuses to run mainnet-style public live execution with
`ALLOW_LIVE_EXECUTION=true`. Production testnet execution uses the separate
Base Sepolia upstream path while `ALLOW_LIVE_EXECUTION=false`.
Enable execution simulation independently and only in a controlled beta
environment. Never expose `BETA_EXECUTION_KEY` in browser code.

Run the server-side simulation smoke test with:

```powershell
$env:XOGGAI_API_BASE='https://your-beta-backend.example.com'
$env:BETA_EXECUTION_KEY='<server-side-secret-at-least-32-characters>'
$env:TEST_ENDPOINT_ID='<allowlisted-endpoint-uuid>'
npm run test:execution-simulation
```

Inspect the pinned Base Sepolia payment challenge without signing or paying:

```powershell
$env:XOGGAI_API_BASE='https://your-beta-backend.example.com'
$env:BETA_EXECUTION_KEY='<server-side-secret-at-least-32-characters>'
$env:TEST_X402_BUDGET='0.005'
npm run x402:operator -- prepare
```

The command exits unless the backend confirms `prepare-only`,
`paymentSigned=false`, and `paymentSent=false`. A successful response includes
a ticket id and challenge hash for operator review. It does not require wallet
funds. Keep the beta key in the operator terminal or secret manager only.

Check execution safety status:

```powershell
npm run x402:operator -- status
```

Approve a prepared ticket from a trusted operator environment only:

```powershell
npm run x402:operator -- approve <prepared-ticket-id>
```

Approval changes the ticket status to `APPROVED`; it still does not sign or
send payment.

Consume an approved ticket before the gated Base Sepolia execution handoff:

```powershell
npm run x402:operator -- consume <approved-ticket-id>
```

Consumption changes the ticket status to `CONSUMED`; it still does not sign or
send payment.

Optionally rehearse Base Sepolia signing after consumption:

```powershell
npm run x402:operator -- sign <consumed-ticket-id>
```

This requires `X402_SIGNING_ENABLED=true` and an isolated testnet wallet
configured server-side. It creates an EIP-3009 payment credential and marks the
ticket `SIGNED`, but never submits the credential to the paid resource or
broadcasts a transaction. The CLI redacts the signature by default. Treat the
full credential as sensitive because another caller could submit it before
expiry.

Verify a consumed ticket without persisting or printing its credential:

```powershell
npm run x402:operator -- sign-verify <consumed-ticket-id>
```

This in-memory handoff signs the ticket and calls the audited x402.org
facilitator `/verify` endpoint. It never calls `/settle`, never retries the paid
resource, and always reports `paymentSettled=false` and `paymentSent=false`.
An unfunded testnet wallet may produce an `INVALID` verification result such as
insufficient balance; that still confirms the verify-only transport and audit
path are working.

The funded Base Sepolia settlement phase is implemented but disabled by
default:

```powershell
$env:X402_CONFIRM_SETTLEMENT='SETTLE_BASE_SEPOLIA'
npm run x402:operator -- sign-verify-settle <consumed-ticket-id>
```

The backend must also have `X402_SETTLEMENT_ENABLED=true`, a valid isolated
Base Sepolia wallet, and `MAX_EXECUTION_BUDGET_USDC` at or below `0.005`.
Settlement accepts only a `VERIFIED` ticket, atomically locks it as `SETTLING`,
and records the transaction or terminal failure. Ambiguous network results are
marked `SETTLEMENT_UNKNOWN` and are never retried automatically.

The paid upstream execution phase is enabled only for the controlled production
testnet beta. Mainnet remains disabled:

```powershell
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run phase5:preflight

$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run x402:operator -- sign-verify-execute <consumed-ticket-id>
```

The backend must also have `X402_UPSTREAM_EXECUTION_ENABLED=true`. This path
signs and verifies a consumed ticket, calls only the audited Base Sepolia x402
resource with a v2 `PAYMENT-SIGNATURE` header, records the upstream response
hash and settlement response, and never retries terminal or unknown results
automatically.

Use `docs/PHASE5_TESTNET_EXECUTION.md` before running the first funded Base
Sepolia upstream execution.

Closed-beta agents can use separate server-side keys with per-request and daily
limits through `BETA_ACCESS_KEYS`. Each new ticket is bound to its beta key id,
and the caller can inspect only its own ledger:

```http
GET /api/beta/executions?limit=25
x-beta-key: <beta key>
```

See `docs/PHASE6_CLOSED_BETA.md` for the registry format, quota behavior, and
rollback process.

Trusted beta operators can inspect their scoped ledger with
`npm run phase6:ledger -- 25` and execute the time-sensitive ticket lifecycle
with `npm run phase6:run` after setting the explicit Base Sepolia confirmation.

Phase 7 adds an invite-only browser console at `/beta/`. User API keys are
stored as hashes, exchanged for short-lived sessions, and can create dry-run
execution requests for operator approval. See `docs/PHASE7_PUBLIC_BETA.md`.

Phase 8 adds production operations: dependency readiness at `/ready`,
structured request logs, an emergency kill switch, protected operational
status, CI release gates, deployment smoke tests, and backup/recovery
procedures. See `docs/PHASE8_PRODUCTION_LAUNCH.md`.

Phase 9 turns approved beta requests into a production testnet product flow.
Operators can execute an approved request on Base Sepolia while the user
console shows `REQUESTED -> APPROVED -> TESTNET_* -> EXECUTED` lifecycle
status, ticket ids, response hashes, and settlement transaction metadata.
Mainnet remains disabled.

Phase 10 upgrades the `/beta/` user console with quota progress, quick intents,
request search, status filters, lifecycle detail views, testnet proof display,
and optional auto-refresh. See `docs/PHASE10_USER_CONSOLE_UPGRADE.md`.

Phase 11 adds a private `/admin/` operator console for queue review,
approve/reject/cancel actions, approved request execution on Base Sepolia, and
operator-visible lifecycle proof. See `docs/PHASE11_OPERATOR_CONSOLE.md`.

Phase 12 adds the `/connect-agent/` developer integration kit with a reusable
JavaScript helper, curl recipes, tool-specific instructions for Claude, Codex,
and Cursor, and production-aligned agent files. Public integrations remain
dry-run-first; controlled execution remains operator-approved on Base Sepolia.
See `docs/PHASE12_DEVELOPER_INTEGRATION_KIT.md`.

Phase 13 hardens the testnet product against abuse and unsafe retries with
identity-aware rate limits, idempotency keys, replay conflict detection,
expiring approval requests, structured audit context, a managed execution
endpoint allowlist, and operational spike/failure alerts. See
`docs/PHASE13_TESTNET_RELIABILITY.md`.

Phase 14 adds the final testnet launch QA gate: live E2E checks, wallet
configuration and optional balance verification, backup/restore drill coverage,
incident drill coverage, mobile UI checks, docs/onboarding pass, and final
go/no-go criteria. See `docs/PHASE14_TESTNET_LAUNCH_QA.md`.

Current audited status: XoggAI is ready as a production-grade public testnet
beta on Base Sepolia. See `docs/TESTNET_PRODUCT_STATUS.md`.

## Repository Map

- `src/` - backend API source.
- `frontend/` - static website, docs UI, public agent files.
- `frontend/examples/` - browser-downloadable starter snippet.
- `examples/` - standalone integration examples.
- `scripts/` - local helper scripts.
- `docs/LAUNCH_CHECKLIST.md` - public launch checklist.
- `docs/TESTNET_PRODUCT_STATUS.md` - current audited testnet product status.
- `docs/PHASE5_TESTNET_EXECUTION.md` - first controlled Base Sepolia execution.
- `docs/PHASE6_CLOSED_BETA.md` - multi-agent beta access, quotas, and ledger.
- `docs/PHASE7_PUBLIC_BETA.md` - invite accounts, sessions, and approval UX.
- `docs/PHASE8_PRODUCTION_LAUNCH.md` - final production launch controls.
- `docs/PHASE9_TESTNET_PRODUCT_EXECUTION.md` - public testnet product execution.
- `docs/PHASE10_USER_CONSOLE_UPGRADE.md` - beta user console upgrade.
- `docs/PHASE11_OPERATOR_CONSOLE.md` - private operator console.
- `docs/PHASE12_DEVELOPER_INTEGRATION_KIT.md` - SDK, curl, and agent integration kit.
- `docs/PHASE13_TESTNET_RELIABILITY.md` - abuse controls and testnet reliability.
- `docs/PHASE14_TESTNET_LAUNCH_QA.md` - final testnet launch QA and go/no-go gate.
- `docs/INCIDENT_RESPONSE.md` - severity, containment, and recovery.
- `docs/BACKUP_RECOVERY.md` - PostgreSQL backup and restore drills.
- `docs/OPERATOR_RUNBOOK.md` - closed-beta ticket and signing runbook.
- `docs/CLOSED_BETA_CHECKLIST.md` - beta readiness checklist.
- `SECURITY.md` - security and public preview safety notes.
- `render.yaml` - Render Blueprint.
- `netlify.toml` - Netlify static deploy config.
