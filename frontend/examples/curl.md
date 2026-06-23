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

Keep beta keys server-side or in trusted operator tooling.

```bash
curl -X POST https://xoggai-backend.onrender.com/api/beta/auth/login \
  -H "content-type: application/json" \
  -d '{"apiKey":"xg_beta_..."}'
```

## Admin Queue

Admin keys are operator secrets. Do not ship them in public browser code.

```bash
curl https://xoggai-backend.onrender.com/api/admin/beta/requests \
  -H "x-admin-key: $PUBLIC_BETA_ADMIN_KEY"
```
