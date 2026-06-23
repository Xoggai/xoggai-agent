# Phase 13 Testnet Reliability and Abuse Control

Phase 13 makes the public Base Sepolia product resilient to retries, replay,
traffic spikes, stale approvals, and accidental endpoint exposure. Mainnet
remains disabled.

## Controls

### Identity rate limits

- Login attempts are limited by a one-way hash of the submitted beta key.
- Execution request creation is limited by authenticated user id.
- Redis counters use bounded fixed windows and never store raw credentials.
- Abuse protection fails closed for beta request creation when Redis is down.

### Idempotency and replay protection

`POST /api/beta/dashboard/requests` requires:

```http
Idempotency-Key: request_01J_EXAMPLE
```

The server stores only a SHA-256 key hash and request fingerprint. A retry with
the same key and body returns the existing request. The same key with different
input returns `409 idempotency_key_conflict`.

### Request expiry

New beta requests receive `expiresAt` using
`PUBLIC_BETA_REQUEST_TTL_SECONDS`. Pending or approved requests become
`EXPIRED` after that deadline and cannot be approved or executed.

### Managed endpoint allowlist

Testnet signing is fail-closed unless the selected endpoint id and registered
URL match an enabled allowlist entry. Operators manage entries with:

```powershell
npm run phase7:admin -- allowlist
npm run phase7:admin -- allow-endpoint <endpointId> "Audited for Base Sepolia"
npm run phase7:admin -- block-endpoint <endpointId> "Disabled during review"
```

The endpoint URL is resolved from the server-side registry. The operator cannot
inject an arbitrary URL through the admin API.

### Audit and alerts

Audit events now support request correlation, severity, outcome, and a hashed
source identifier. Operators can inspect them with:

```powershell
npm run phase7:admin -- audit 100
npm run phase8:ops
```

The operations response reports request spikes, recent execution failures,
expired requests, idempotent replays, and enabled allowlist entries. Active
threshold breaches are emitted as structured warning logs.

## Environment

```text
PUBLIC_BETA_REQUEST_TTL_SECONDS=900
PUBLIC_BETA_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_BETA_RATE_LIMIT_MAX=10
PUBLIC_BETA_ALERT_REQUEST_SPIKE=50
PUBLIC_BETA_ALERT_FAILURE_THRESHOLD=5
```

## Deployment Order

1. Deploy so the idempotent migration adds the new columns and allowlist table.
2. Confirm `/ready` is healthy.
3. List registered endpoints and audit the intended Base Sepolia endpoint.
4. Add only the audited endpoint id to the managed allowlist.
5. Run one controlled request and inspect audit plus operations output.
6. Keep mainnet and standalone settlement disabled.
