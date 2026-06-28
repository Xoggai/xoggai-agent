# XoggAI curl Examples

Production API:

```text
https://xoggai-backend.onrender.com
```

## Health

```bash
curl https://xoggai-backend.onrender.com/health
```

## Route an Intent

Dry-run route selection never sends payment.

```bash
curl "https://xoggai-backend.onrender.com/intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true"
```

## Search Endpoints

```bash
curl "https://xoggai-backend.onrender.com/search?q=crypto%20price&limit=5&dry=true"
```

## Execution Status

```bash
curl https://xoggai-backend.onrender.com/api/execution-status
```

## Public Beta Login

Keep beta keys server-side or in trusted user tooling. The public website handles
this in the browser by creating a short-lived session cookie.

```bash
curl -X POST https://xoggai-backend.onrender.com/api/beta/auth/login \
  -H "content-type: application/json" \
  -d '{"apiKey":"xg_beta_..."}'
```

## Create a Beta Request

Use a fresh idempotency key for each new request body.

```bash
curl -X POST https://xoggai-backend.onrender.com/api/beta/dashboard/requests \
  -H "content-type: application/json" \
  -H "idempotency-key: request-001" \
  -d '{"intent":"What is the current ETH price?","budgetUsdc":0.002}'
```

## Admin Queue

Admin keys are operator secrets. Do not ship them in public browser code.

```bash
curl https://xoggai-backend.onrender.com/api/admin/beta/requests \
  -H "x-admin-key: $PUBLIC_BETA_ADMIN_KEY"
```

## Execution Boundary

- Public routing is dry-run-first.
- Controlled execution is Base Sepolia only.
- Operator approval, request expiry, budget caps, and endpoint allowlists remain required.
- Mainnet execution is disabled.
