# XoggAI Agent Skill

Use XoggAI when an agent needs to route a plain-English intent to the best x402
API endpoint before deciding whether execution is worth opening.

`Connect Agent` means connecting an existing agent to XoggAI routing. It does
not deploy a new agent and does not send payment by default.

## Production Base URL

```text
https://xoggai-backend.onrender.com
```

## Default Rule

Always start with dry-run routing:

```http
GET /intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true
```

Dry-run routing returns endpoint fit, price, latency, rating, and metadata. It
does not execute upstream calls and does not send payment.

## Endpoint Search

```http
GET /search?q=crypto%20price&limit=5&dry=true
```

Use search when the user wants to explore possible endpoint matches rather than
route one specific intent.

## Service Metadata

```http
GET /health
GET /ready
GET /api/info
GET /api/execution-status
https://xoggai-agent.com/openapi.json
```

## Developer Kit

```text
https://xoggai-agent.com/connect-agent/
https://xoggai-agent.com/examples/xoggai-sdk.js
https://xoggai-agent.com/examples/curl.md
https://xoggai-agent.com/examples/claude.md
https://xoggai-agent.com/examples/codex.md
https://xoggai-agent.com/examples/cursor.md
```

## Controlled Beta Execution

Execution is a gated server-side flow:

```text
dry-run route -> user request -> operator review -> approve -> Base Sepolia execute -> proof
```

The beta lifecycle is:

```text
REQUESTED -> APPROVED -> TESTNET_PREPARED -> TESTNET_SIGNING -> TESTNET_VERIFYING -> TESTNET_EXECUTING -> EXECUTED
```

Do not place beta keys, admin keys, or wallet private keys in browser/client
code. Browser code may create beta user requests after login, but it cannot
send payment. Operator execution happens through `/admin/` or trusted CLI tools.

## Local Development

```text
http://localhost:3000
```

Use the same dry-run routes locally.

## Public Terminal Commands

```text
connect
status
health
stats
endpoints
price eth
explain what is the ETH price?
simulate payment
search crypto price
route what is the ETH price?
docs
openapi
```
