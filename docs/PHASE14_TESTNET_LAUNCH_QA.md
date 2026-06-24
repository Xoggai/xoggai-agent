# Phase 14: Testnet Launch QA

Phase 14 is the final audit layer before XoggAI is treated as a
production-grade testnet product. It does not enable mainnet. It verifies that
the Base Sepolia public beta is live, guarded, documented, and recoverable.

## Scope

- Full E2E launch QA across backend, frontend, docs, and agent files.
- Wallet funded check without exposing wallet secrets.
- Backup and restore drill readiness.
- Incident response drill readiness.
- Mobile UI and onboarding pass.
- Final go/no-go criteria for public testnet usage.

Out of scope:

- Mainnet execution.
- Raising budget caps.
- Removing the operator approval and allowlist controls.
- Running destructive restore commands against production.

## One-Command QA

Run the final launch QA:

```powershell
npm run phase14:qa
```

The command checks:

- backend `/health`, `/ready`, `/api/info`, and `/api/execution-status`
- dry-run `/intent` and `/search`
- frontend home, docs, beta console, connect-agent page, raw agent files, SDK,
  examples, preview image, and favicon
- local OpenAPI JSON validity
- backup and incident runbook coverage
- mobile viewport/breakpoint presence across public UIs
- public testnet guardrails:
  - `safetyMode: testnet-upstream-execution`
  - `network: base-sepolia`
  - `liveExecutionEnabled: false`
  - `upstreamExecutionEnabled: true`
  - `paymentSigningEnabled: true`
  - `paymentVerificationEnabled: true`
  - `paymentSendingEnabled: true`
  - idempotency keys required
  - request expiry before execution
  - managed endpoint allowlist required

If `PUBLIC_BETA_ADMIN_KEY` is set locally, the command also checks
`/api/admin/ops` and requires reliability status to be healthy.

## Wallet Funded Check

The QA command always confirms the deployed backend reports
`walletConfigured: true`.

For a direct Base Sepolia balance check, set these local-only variables:

```powershell
$env:PHASE14_WALLET_ADDRESS='<dedicated Base Sepolia wallet address>'
$env:PHASE14_BASE_SEPOLIA_RPC_URL='<Base Sepolia RPC URL>'
$env:PHASE14_MIN_WALLET_ETH='0.00001'
npm run phase14:qa
```

The script prints only a shortened wallet address and ETH balance. It never
prints or requires the private key.

## Backup / Restore Drill

Backup command:

```powershell
$env:DATABASE_URL='<Render external PostgreSQL URL>'
npm run backup:database
```

Restore drills must use a temporary database only:

```powershell
pg_restore --clean --if-exists --no-owner --no-privileges `
  --dbname '<temporary database URL>' backups/xoggai-<timestamp>.dump
```

Pass criteria:

- backup file is created outside Git-tracked paths
- restore is performed only against a temporary database
- `/ready` succeeds against the restored temporary database
- counts are checked for users, keys, sessions, requests, audit events,
  endpoints, and execution tickets
- production remains untouched

## Incident Drill

For payment uncertainty, abuse, or credential exposure:

1. Set `OPERATIONS_KILL_SWITCH=true`.
2. Set `PUBLIC_BETA_ENABLED=false` if public beta traffic should stop.
3. Confirm mutation endpoints return `503`.
4. Rotate affected keys or wallet credentials.
5. Preserve request ids, audit events, Render logs, and transaction hashes.
6. Fix locally and run:

```powershell
npm test
npm audit --omit=dev
npm run production:check
npm run phase14:qa
```

Unknown payment or upstream results must never be retried automatically.

## Mobile UI Pass

Minimum screens to check manually after deploy:

- `https://xoggai-agent.com/`
- `https://xoggai-agent.com/docs`
- `https://xoggai-agent.com/connect-agent/`
- `https://xoggai-agent.com/beta/`

Pass criteria:

- navigation is reachable
- terminal/demo controls do not overflow
- beta request form is usable
- request cards and detail panel are readable
- copy/download buttons remain tappable
- no secrets or admin-only controls are visible in public pages

## Docs And Onboarding Pass

Before launch, confirm these paths are current:

- `README.md`
- `docs/LAUNCH_CHECKLIST.md`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/BACKUP_RECOVERY.md`
- `docs/INCIDENT_RESPONSE.md`
- `frontend/skill.md`
- `frontend/llms.txt`
- `frontend/openapi.json`
- `frontend/examples/xoggai-sdk.js`
- `frontend/examples/curl.md`

The public message must stay consistent:

- XoggAI is public testnet beta on Base Sepolia.
- Mainnet is not enabled.
- Live execution is still controlled by operator approval, request expiry,
  budget caps, and allowlisted endpoints.
- Browser code never receives wallet secrets.

## Go / No-Go

Go when all are true:

- `npm test` passes
- `npm audit --omit=dev` reports zero vulnerabilities
- `npm run production:check` passes
- `npm run phase14:qa` passes against live Render and Netlify
- Render backend is deployed at the latest expected commit
- Netlify frontend is deployed at the latest expected commit
- the Base Sepolia wallet is configured and funded for the intended test size
- backup and incident drills have current runbooks
- public docs consistently say testnet, not mainnet

No-go if any are true:

- `ALLOW_LIVE_EXECUTION=true`
- network is not `base-sepolia`
- wallet secret appears in frontend or docs
- request execution bypasses approval, idempotency, expiry, or allowlist
- `/ready` reports unhealthy database or cache
- `/api/admin/ops` reports active reliability alerts during launch

After Phase 14 passes, XoggAI is ready as a production-grade testnet product.
Mainnet remains a separate integration phase.
