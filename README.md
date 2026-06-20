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
  <a href="https://xoggai-agent.com"><img alt="Mode" src="https://img.shields.io/badge/mode-dry--run%20preview-f7fbf6?style=flat-square&labelColor=06150d"></a>
</p>

XoggAI is a dry-run-first intent router for AI agents and x402 APIs.

Agents send a plain-English intent, inspect ranked endpoint previews, and decide when execution should move from discovery into a wallet-gated path.

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

The public product is live as a preview. The default mode is dry-run routing, so users can inspect route fit, cost, latency, rating, URL, and schema before enabling any paid execution path.

## Live Preview

- Website: https://xoggai-agent.com
- Terminal demo: https://xoggai-agent.com/#agent-console
- Docs UI: https://xoggai-agent.com/docs
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

- Live today: frontend, backend, terminal demo, docs UI, endpoint previews.
- Default mode: dry-run routing.
- Safe by default: dry-runs do not send payment.
- Not public yet: live x402 paid execution.
- Future live execution requires explicit wallet and budget controls.

## How It Works

1. Agent sends a natural-language intent.
2. XoggAI embeds/searches/ranks matching x402 API endpoints.
3. XoggAI returns endpoint metadata in dry-run mode.
4. The caller sees price, latency, rating, URL, and schema before execution.
5. Future live execution requires an intentional wallet and budget path.

## Architecture

```text
frontend terminal/docs
-> backend intent router
-> endpoint index + rating engine
-> dry-run preview response
-> optional future x402 execution path
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
GET /intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true
GET /search?q=crypto%20price&limit=5&dry=true
GET /api/stats
GET /api/feed
GET /api/endpoints
```

Minimal agent snippet:

```ts
const XOGGAI_API = 'https://xoggai-backend.onrender.com';

export async function routeIntent(intent: string, budget = 0.05) {
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
curl.exe "https://xoggai-backend.onrender.com/intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true"
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
X402_PREPARE_ENABLED=false
BETA_EXECUTION_KEY=<server-side-secret-at-least-32-characters>
MAX_EXECUTION_BUDGET_USDC=0.05
EXECUTION_ENDPOINT_ALLOWLIST=<comma-separated-endpoint-uuids>
```

Keep `ALLOW_LIVE_EXECUTION=false` for public demos.

For an isolated Base Sepolia simulation environment, review
[`render.beta.yaml`](render.beta.yaml) and
[`docs/BETA_ENDPOINT_AUDIT.md`](docs/BETA_ENDPOINT_AUDIT.md). The beta template
ships with an empty endpoint allowlist by design and does not enable payments.
When `X402_PREPARE_ENABLED=true`, `POST /execute/prepare` can fetch and validate
the audited endpoint's unpaid 402 challenge and store a short-lived
`PREPARED` approval ticket. This prepare-only route never creates a signature,
retries with payment credentials, or sends a transaction.
The backend still refuses to start with `ALLOW_LIVE_EXECUTION=true` until the
live payment implementation exists and passes a separate audit.
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

Consume an approved ticket before the future live execution handoff:

```powershell
npm run x402:operator -- consume <approved-ticket-id>
```

Consumption changes the ticket status to `CONSUMED`; it still does not sign or
send payment.

## Repository Map

- `src/` - backend API source.
- `frontend/` - static website, docs UI, public agent files.
- `frontend/examples/` - browser-downloadable starter snippet.
- `examples/` - standalone integration examples.
- `scripts/` - local helper scripts.
- `docs/LAUNCH_CHECKLIST.md` - public launch checklist.
- `docs/OPERATOR_RUNBOOK.md` - closed-beta prepare/approve/consume runbook.
- `docs/CLOSED_BETA_CHECKLIST.md` - beta readiness checklist.
- `SECURITY.md` - security and public preview safety notes.
- `render.yaml` - Render Blueprint.
- `netlify.toml` - Netlify static deploy config.
