# Phase 6 Closed Beta

Phase 6 turns the proven Phase 5 testnet execution path into a controlled
multi-agent beta.

It does not make paid execution public. Public website users remain dry-run
only.

## Capabilities

- Multiple beta keys with separate identities.
- Per-key request budget.
- Per-key daily request quota.
- Per-key daily budget quota.
- Ticket ownership enforcement.
- Execution ledger scoped to the requesting beta key.
- Existing global `BETA_EXECUTION_KEY` remains available as a legacy fallback
  when `BETA_ACCESS_KEYS` is empty.

## Beta Registry

Store `BETA_ACCESS_KEYS` directly in Render. Never commit real keys.

Example:

```json
[
  {
    "id": "agent-alpha",
    "label": "Agent Alpha",
    "key": "replace-with-at-least-32-random-characters",
    "enabled": true,
    "maxBudgetUsdc": 0.005,
    "dailyRequestLimit": 10,
    "dailyBudgetUsdc": 0.02
  }
]
```

Requirements:

- `id` must be unique.
- `key` must contain at least 32 characters.
- Keys and ids must be unique.
- Set `enabled: false` to revoke a beta key.
- Do not expose keys to browser code.
- Use one key per trusted server-side agent or tester integration.

Global defaults:

```text
BETA_DAILY_REQUEST_LIMIT=25
BETA_DAILY_BUDGET_USDC=0.05
MAX_EXECUTION_BUDGET_USDC=0.005
```

Profile values override the global beta defaults.

## Ticket Ownership

Every new prepared ticket records:

- beta key id
- beta client label

Approve, consume, sign, verify, settle, and upstream execution requests are
scoped to the beta key that created the ticket. A different valid beta key
receives `payment_ticket_not_found`.

No secret key is stored in PostgreSQL.

## Quota Enforcement

Before XoggAI fetches an x402 challenge, `/execute/prepare` checks:

- requested budget does not exceed the profile max
- daily request count is below the profile limit
- daily prepared budget plus the new request stays below the daily cap

Blocked responses:

- `beta_budget_exceeded`
- `beta_daily_request_limit_exceeded`
- `beta_daily_budget_exceeded`

All quota windows reset at `00:00 UTC`.

## Beta Ledger

Trusted server-side callers can inspect their own execution history:

```http
GET /api/beta/executions?limit=25
x-beta-key: <beta key>
```

The response includes:

- beta identity and limits
- daily usage and remaining quota
- ticket status
- resource and amount
- verification and upstream status
- response hashes
- Base Sepolia transaction reference

The endpoint never returns wallet keys, beta secrets, or payment credentials.

The operator CLI exposes the same scoped view:

```powershell
npm run phase6:ledger -- 25
```

## One-Shot Beta Execution

The x402 challenge expires quickly. Use the one-shot command instead of pausing
between prepare, approve, consume, sign, verify, and upstream execution:

```powershell
$env:XOGGAI_API_BASE='https://xoggai-backend.onrender.com'
$env:BETA_EXECUTION_KEY='<the agent beta key>'
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
$env:TEST_X402_BUDGET='0.005'
npm run phase6:run
```

The command runs the full preflight first and stops before creating a ticket if
the backend, wallet, network, budget cap, or explicit confirmation is unsafe.
It then completes the ticket lifecycle in one process and prints only the final
audited result.

## Safe Operating State

Keep these disabled outside scheduled beta sessions:

```text
X402_SIGNING_ENABLED=false
X402_VERIFY_ENABLED=false
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=false
```

`X402_PREPARE_ENABLED=true` may be used for ticket-only beta rehearsal.

## Rollback

1. Disable signing, verification, settlement, and upstream execution.
2. Set a profile to `enabled: false` to revoke one tester.
3. Remove or rotate a compromised profile key.
4. Disable `X402_PREPARE_ENABLED` to stop new tickets.
5. Inspect `/api/beta/executions` and Render logs.
6. Never automatically retry unknown execution states.
