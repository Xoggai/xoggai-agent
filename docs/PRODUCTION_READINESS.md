# Production Readiness

Phase 4 keeps XoggAI deployable without making paid execution public.

The production website remains a public preview. Public users can inspect routes,
use the terminal demo, read agent files, and call dry-run APIs. Paid x402
execution remains closed-beta only and disabled by default in deployment config.

## Phase 4 Boundary

In scope:

- Production deploy guardrails.
- Static docs and agent files that describe the gated flow accurately.
- Render and Netlify configuration checks.
- Operator runbook coverage for payment-adjacent paths.
- Repeatable pre-push checks.

Out of scope:

- Funding a Base Sepolia wallet.
- Running a real paid upstream x402 request.
- Opening paid execution to public users.
- Building tester accounts, public billing, or user wallets.

## Production Defaults

The public Render Blueprint must keep these values disabled:

```text
ALLOW_LIVE_EXECUTION=false
EXECUTION_SIMULATION_ENABLED=false
X402_PREPARE_ENABLED=false
X402_SIGNING_ENABLED=false
X402_VERIFY_ENABLED=false
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=false
```

The beta Blueprint may enable ticket preparation, but must still keep signing,
verification, settlement, and upstream execution disabled until a trusted
operator intentionally schedules one testnet run.

## Public Product State

User-visible functionality:

- Website and docs UI.
- Terminal demo.
- Dry-run `/intent` route selection.
- Endpoint search.
- Static agent files: `skill.md`, `llms.txt`, `openapi.json`.

Not public:

- Server-side beta key.
- Wallet signing.
- Facilitator verification.
- Standalone settlement.
- Paid upstream execution.

## Pre-Push Commands

Run these before pushing production-facing work:

```powershell
npm test
npm audit --omit=dev
npm run production:check
git diff --check
```

Expected result:

- all tests pass
- zero production dependency vulnerabilities
- production readiness checks pass
- no whitespace errors

## Post-Push Checks

After Netlify and Render finish deploying:

- `https://xoggai-agent.com` loads over HTTPS.
- `https://xoggai-agent.com/docs` loads.
- `https://xoggai-agent.com/openapi.json` is valid JSON.
- `https://xoggai-backend.onrender.com/health` returns `status: ok`.
- `https://xoggai-backend.onrender.com/api/execution-status` reports:
  - `liveExecutionEnabled: false`
  - `paymentSigningEnabled: false`
  - `paymentVerificationEnabled: false`
  - `paymentSendingEnabled: false`
- The terminal `status` and `route what is the ETH price?` commands still work.

## Rollback

If production behavior looks unsafe:

- Stop sharing the new URL or post.
- Revert the last GitHub commit or roll back the Netlify deploy.
- Pause or roll back the Render service.
- Confirm all x402 execution flags are disabled.
- Rotate `BETA_EXECUTION_KEY` if it was exposed.

## Next Phase

Phase 5 is the first real Base Sepolia end-to-end execution. It requires a
dedicated funded testnet wallet and should run only after this Phase 4 checklist
passes on the deployed environment.
