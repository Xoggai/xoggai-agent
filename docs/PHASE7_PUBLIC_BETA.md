# Phase 7 Public Beta Product Layer

Phase 7 adds an invite-only user product on top of the Phase 6 execution
controls.

The public beta does not expose wallet keys, operator beta keys, or direct
payment execution to browser code.

## Product Flow

1. An operator creates an invited beta account.
2. The API key is shown once and delivered securely to the user.
3. The user signs in at `https://xoggai-agent.com/beta/`.
4. The API key is exchanged for a short-lived opaque session.
5. The user submits an intent and budget.
6. XoggAI performs dry-run routing and creates an approval request.
7. An operator approves or rejects the request.
8. Paid execution remains a separate operator-controlled process.

## Security Model

- API keys are generated from 32 random bytes.
- PostgreSQL stores SHA-256 hashes, not raw API keys.
- Session tokens are generated independently and stored as hashes.
- The browser stores only the short-lived session in `sessionStorage`.
- Accounts, API keys, and sessions can be suspended or revoked.
- User request history is scoped by authenticated user id.
- Per-request and daily limits are enforced server-side.
- The dashboard cannot sign or send x402 payments.
- Admin endpoints require `PUBLIC_BETA_ADMIN_KEY`.

## Render Configuration

Set directly in Render:

```text
PUBLIC_BETA_ADMIN_KEY=<random secret with at least 32 characters>
PUBLIC_BETA_SESSION_TTL_SECONDS=86400
```

Keep payment flags disabled unless an operator schedules a controlled execution:

```text
X402_SIGNING_ENABLED=false
X402_VERIFY_ENABLED=false
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=false
```

## Create An Invite

Set the admin secret locally, then run:

```powershell
$env:XOGGAI_API_BASE='https://xoggai-backend.onrender.com'
$env:PUBLIC_BETA_ADMIN_KEY='<same secret as Render>'
npm run phase7:admin -- create-user user@example.com "Agent User"
```

The returned `apiKey` is shown once. Do not post it in chat, logs, or public
channels.

List users, rotate a key, or revoke a key:

```powershell
npm run phase7:admin -- users
npm run phase7:admin -- keys <user-id>
npm run phase7:admin -- create-key <user-id> "Replacement key"
npm run phase7:admin -- revoke-key <key-id>
```

Optional per-user limits:

```powershell
$env:BETA_USER_MAX_BUDGET_USDC='0.005'
$env:BETA_USER_DAILY_REQUEST_LIMIT='10'
$env:BETA_USER_DAILY_BUDGET_USDC='0.02'
```

## Approval Queue

List pending requests:

```powershell
npm run phase7:admin -- requests REQUESTED
```

Approve:

```powershell
npm run phase7:admin -- decide <request-id> APPROVED "Reviewed"
```

Reject:

```powershell
npm run phase7:admin -- decide <request-id> REJECTED "Reason"
```

Approval records intent, endpoint, price, budget, operator, reason, and
timestamp. It still does not send payment.

## User APIs

```text
POST /api/beta/auth/login
POST /api/beta/auth/logout
GET  /api/beta/dashboard/me
GET  /api/beta/dashboard/requests
POST /api/beta/dashboard/requests
```

All dashboard endpoints except login require:

```http
Authorization: Bearer <session token>
```

## Rollback

1. Remove or rotate `PUBLIC_BETA_ADMIN_KEY`.
2. Keep all x402 signing and sending flags disabled.
3. Suspend affected users or revoke sessions/API keys in PostgreSQL.
4. Roll back the Netlify beta dashboard if UI behavior is unsafe.
5. Review `beta_audit_events` and `beta_execution_requests`.
