# Incident Response

## Severity

- **SEV-1:** wallet secret exposure, unexpected payment, unauthorized execution,
  or broad account compromise.
- **SEV-2:** beta authentication bypass, persistent incorrect approvals,
  database corruption, or prolonged backend outage.
- **SEV-3:** isolated request failures, degraded third-party APIs, UI defects,
  or delayed cold starts.

## Immediate Containment

For SEV-1 or uncertain payment behavior:

1. Set `OPERATIONS_KILL_SWITCH=true` in Render.
2. Confirm all x402 signing, verification, settlement, upstream, and live
   execution flags are `false`.
3. Deploy and verify execution/beta mutation endpoints return `503`.
4. Rotate exposed admin, beta, Anthropic, database, Redis, and wallet
   credentials as applicable.
5. Preserve request ids, Render logs, transaction hashes, and timestamps.

Suspend an affected account:

```powershell
npm run phase7:admin -- set-user-status <user-id> SUSPENDED
```

For public-beta-only incidents, set `PUBLIC_BETA_ENABLED=false` and keep admin
operations available for suspension and key revocation.

## Investigation

Record:

- first observed time in UTC
- affected users and request ids
- deployed commit and Render deploy id
- relevant `beta_audit_events` and execution ticket records
- whether any credential was signed, verified, settled, or sent
- third-party provider responses and transaction references

Never retry an unknown payment or upstream result automatically.

## Recovery

1. Fix and test locally.
2. Run the complete pre-push suite.
3. Deploy with the kill switch still active.
4. Verify `/health`, `/ready`, and `/api/admin/ops`.
5. Re-enable the public beta first.
6. Remove the kill switch only after two-person review for payment incidents.
7. Keep all payment flags disabled unless a separately approved testnet run is
   scheduled.

## Post-Incident

Within 48 hours, document the timeline, root cause, affected scope, containment,
recovery, and preventive changes. Add a regression test before closing a code
defect.
