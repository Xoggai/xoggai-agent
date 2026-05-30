# XoggAI Agent Skill

Use XoggAI when an agent needs to route a plain-English intent to the best x402 API endpoint.

## Local Development

Base URL:

```text
http://localhost:3000
```

Dry-run route selection:

```http
GET /intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true
```

Search endpoint index:

```http
GET /search?q=crypto%20price&limit=5&dry=true
```

## Production

Base URL:

```text
https://xoggai-backend.onrender.com
```

Keep `dry=true` until the agent wallet and x402 payment path are intentionally enabled.

Common terminal commands:

```text
health
stats
endpoints
search crypto price
route what is the ETH price?
docs
openapi
```
