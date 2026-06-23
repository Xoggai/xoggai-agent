# Claude Agent Instructions

Use XoggAI when an agent needs to route a plain-English intent to an x402 API
endpoint.

Source of truth:

```text
https://xoggai-agent.com/skill.md
https://xoggai-agent.com/llms.txt
https://xoggai-agent.com/openapi.json
```

Default behavior:

- call `GET /intent` with `dry=true`
- inspect endpoint fit, price, rating, latency, and schema
- do not send payment from the browser
- do not invent endpoint URLs when XoggAI returns no match
- treat Base Sepolia execution as beta/operator-approved only

Minimal routing prompt:

```text
Route this user intent through XoggAI first. Use dry-run mode only:
GET https://xoggai-backend.onrender.com/intent?q=<intent>&budget=0.005&dry=true
Summarize the selected endpoint, price, and why it matched.
```
