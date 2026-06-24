# Testnet Product Status

XoggAI is currently a production-grade public testnet beta on Base Sepolia.
This is the canonical status document for the current product phase.

## Current Status

- Frontend is live at `https://xoggai-agent.com`.
- Backend is live at `https://xoggai-backend.onrender.com`.
- Public beta console is enabled.
- Private operator console is enabled.
- Dry-run routing is available publicly.
- Approved beta requests can execute through the gated Base Sepolia x402 path.
- Mainnet execution is not enabled.
- `ALLOW_LIVE_EXECUTION=false` remains required.
- Browser-delivered code never receives wallet private keys, beta execution
  keys, or admin keys.

## Verified Live Checks

The current live release has passed:

```powershell
npm test
npm audit --omit=dev
npm run production:check
npm run phase8:smoke
npm run phase14:qa
```

The Phase 14 launch QA result is:

```text
production-grade testnet beta ready
```

## Enabled Testnet Capabilities

- Base Sepolia network only.
- Dry-run-first endpoint routing.
- Authenticated beta user requests.
- Server-side idempotency keys.
- Request expiry before execution.
- Per-user and daily budget limits.
- Operator approval before execution.
- Managed endpoint allowlist.
- Base Sepolia payment signing and verification.
- Audited upstream x402 execution.
- Structured audit events.
- Reliability alerts and emergency kill switch.
- Backup and incident runbooks.

## Not Enabled

- Mainnet payment execution.
- Self-serve permissionless paid execution.
- Browser-side wallet signing.
- Automatic retry of unknown payment or upstream states.
- Raising public budget caps beyond the testnet limit.
- Removing operator approval, idempotency, expiry, or allowlist controls.

## User Readiness

The product can be shared with controlled beta users when:

- the user has a beta invite/API key
- the selected endpoint remains allowlisted
- the operator queue is monitored
- the Base Sepolia wallet is funded for the intended test size
- `OPERATIONS_KILL_SWITCH=false`
- `PUBLIC_BETA_ENABLED=true`

User-facing language should say:

```text
XoggAI is live as a public testnet beta on Base Sepolia.
Mainnet remains a separate future migration.
```

## Mainnet Boundary

Mainnet migration is intentionally out of scope for the current phase. The next
mainnet phase must include a separate risk audit, isolated mainnet wallet,
lower initial caps, endpoint allowlist review, and fresh E2E execution tests.
