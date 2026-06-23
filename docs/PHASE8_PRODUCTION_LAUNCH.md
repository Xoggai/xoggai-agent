# Phase 8 Production Launch

Phase 8 turns the invite-only beta into an operable production service. It
does not make paid x402 execution public and does not remove operator approval.

## Launch Boundary

Production-ready means:

- frontend, docs, beta console, and backend deploy successfully
- PostgreSQL and Redis readiness is observable
- every request receives a request id and structured log entry
- the public beta and execution APIs can be stopped centrally
- database backups and restore drills have documented procedures
- CI blocks changes that fail tests, dependency audit, or readiness checks
- a repeatable production smoke test validates the deployed services

It does not mean:

- anonymous paid execution
- browser-held wallet keys
- automatic payment retries
- mainnet payment execution

## Required Render Configuration

```text
DEPLOYMENT_ENVIRONMENT=production
PUBLIC_BETA_ENABLED=true
OPERATIONS_KILL_SWITCH=false
READINESS_TIMEOUT_MS=2500
```

`PUBLIC_BETA_ADMIN_KEY` remains required for account administration and the
protected operations endpoint.

## Production Endpoints

```text
GET /health
GET /ready
GET /api/execution-status
GET /api/admin/ops
```

`/health` proves the process is alive. `/ready` checks PostgreSQL and Redis and
returns `503` when either dependency is unavailable. `/api/admin/ops` requires
`x-admin-key` and returns readiness plus beta account/request counts.

Operator status:

```powershell
npm run phase8:ops
```

## Kill Switch

Set this in Render and deploy:

```text
OPERATIONS_KILL_SWITCH=true
```

This blocks execution endpoints and public-beta login/dashboard operations
with `503`. Health, readiness, and admin operations remain available.

To disable only the public beta:

```text
PUBLIC_BETA_ENABLED=false
```

Do not enable payment flags while resolving an incident.

Suspend a compromised account:

```powershell
npm run phase7:admin -- set-user-status <user-id> SUSPENDED
```

Suspension immediately revokes its active sessions.

## Release Verification

Before push:

```powershell
npm test
npm audit --omit=dev
npm run production:check
git diff --check
```

After Render and Netlify deploy:

```powershell
npm run phase8:smoke
```

The smoke test fails if dependencies are degraded, payment sending is enabled,
the kill switch is active, the beta is disabled, or public pages are missing.

## Limited Rollout

1. Start with one internal account.
2. Add no more than five invited accounts in the first cohort.
3. Keep per-request budget at or below `0.005` USDC.
4. Review pending requests and logs daily.
5. Revoke inactive or compromised keys.
6. Expand only after seven days without unresolved severity-1 or severity-2
   incidents.

## Completion Criteria

Phase 8 is complete after:

- CI is green on `main`
- `/ready` reports both dependencies healthy
- `phase8:smoke` passes against production
- one backup is created and a restore drill is recorded
- the kill switch procedure has been tested without payment flags enabled
- the first invited cohort completes login, request, approval, and logout
