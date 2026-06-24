# Production Readiness

XoggAI is a production-grade public testnet beta with dry-run-first routing and
operator-controlled Base Sepolia execution. Mainnet payment remains disabled.

## Required Capabilities

- Process liveness at `/health`.
- PostgreSQL and Redis readiness at `/ready`.
- Structured JSON request logs with `X-Request-Id`.
- Emergency `OPERATIONS_KILL_SWITCH`.
- Independent `PUBLIC_BETA_ENABLED` gate.
- Hashed API keys and sessions.
- Server-side per-request and daily quotas.
- Protected operational status at `/api/admin/ops`.
- CI build, test, dependency audit, and readiness checks.
- Production smoke test and database backup procedure.
- Phase 14 launch QA covering live endpoints, docs, agent files, wallet
  configuration, backup/incident runbooks, and mobile/onboarding readiness.

## Production Defaults

```text
ALLOW_LIVE_EXECUTION=false
EXECUTION_SIMULATION_ENABLED=false
X402_PREPARE_ENABLED=true
X402_SIGNING_ENABLED=true
X402_VERIFY_ENABLED=true
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=true
X402_NETWORK=base-sepolia
PUBLIC_BETA_ENABLED=true
OPERATIONS_KILL_SWITCH=false
DEPLOYMENT_ENVIRONMENT=production
```

## Pre-Push Gate

```powershell
npm test
npm audit --omit=dev
npm run production:check
git diff --check
```

## Post-Deploy Gate

```powershell
npm run phase8:smoke
npm run phase14:qa
```

Also verify the protected endpoint with the admin secret:

```powershell
curl.exe https://xoggai-backend.onrender.com/api/admin/ops `
  -H "x-admin-key: $env:PUBLIC_BETA_ADMIN_KEY"
```

Expected:

- readiness is healthy
- kill switch is false
- public beta is true
- payment sending is true only for Base Sepolia upstream execution while
  `liveExecutionEnabled` remains false
- pending request count is plausible

## Backup Gate

Create an encrypted backup before schema or payment-control changes:

```powershell
npm run backup:database
```

Record a restore drill using `docs/BACKUP_RECOVERY.md`.

## Rollback

1. Set `OPERATIONS_KILL_SWITCH=true`.
2. Keep every payment flag false.
3. Roll back Render and Netlify to the last known-good commit.
4. Verify `/health`, `/ready`, and `/api/admin/ops`.
5. Rotate affected credentials and revoke sessions.
6. Reopen the beta only after the incident checklist passes.

Phase 8 details are in `docs/PHASE8_PRODUCTION_LAUNCH.md`.
Final launch QA details are in `docs/PHASE14_TESTNET_LAUNCH_QA.md`.
Current testnet product status is in `docs/TESTNET_PRODUCT_STATUS.md`.
