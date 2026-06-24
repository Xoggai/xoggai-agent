# Deployment

XoggAI is split into a static frontend and a Render-hosted backend.

## Frontend

- Host: Netlify
- Config: `netlify.toml`
- Publish directory: `frontend/`
- Production domain: `https://xoggai-agent.com`

Important public files:

- `/docs`
- `/connect-agent/`
- `/beta/`
- `/admin/`
- `/skill.md`
- `/llms.txt`
- `/openapi.json`

## Backend

- Host: Render
- Config: `render.yaml`
- Service: `xoggai-backend`
- Production URL: `https://xoggai-backend.onrender.com`
- Dependencies: PostgreSQL and Redis-compatible key/value store

## Required Environment

Keep all secrets in Render, never in the frontend or repository.

```text
ALLOWED_ORIGINS=https://xoggai-agent.com,https://www.xoggai-agent.com
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
PUBLIC_BETA_ENABLED=true
OPERATIONS_KILL_SWITCH=false
```

`ALLOW_LIVE_EXECUTION=false` must remain false for the public testnet beta.
Controlled Base Sepolia upstream execution uses the separate guarded x402 path.

## Release Checks

```powershell
npm test
npm audit --omit=dev
npm run production:check
npm run phase14:qa
git diff --check
```

## Operator Commands

Check safety status:

```powershell
npm run x402:operator -- status
```

Prepare a Base Sepolia x402 ticket:

```powershell
$env:TEST_X402_BUDGET='0.005'
npm run x402:operator -- prepare
```

Approve and consume a ticket:

```powershell
npm run x402:operator -- approve <ticket-id>
npm run x402:operator -- consume <ticket-id>
```

Execute an approved beta request:

```powershell
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run phase9:execute -- <request-id>
```

See [OPERATOR_RUNBOOK.md](OPERATOR_RUNBOOK.md) for the complete operator flow.
