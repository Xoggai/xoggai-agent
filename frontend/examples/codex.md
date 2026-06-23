# Codex Agent Instructions

Use XoggAI as a dry-run-first x402 intent router.

When asked to connect an agent:

1. Read `https://xoggai-agent.com/skill.md`.
2. Use `https://xoggai-agent.com/openapi.json` for endpoint shape.
3. Call `/intent` with `dry=true` before any execution flow.
4. Keep beta keys and admin keys outside client-side code.
5. Treat execution as Base Sepolia testnet-only unless explicitly changed by
   the operator.

Example:

```ts
import { routeIntent } from './xoggai-sdk.js'

const result = await routeIntent('what is the ETH price?', {
  budget: 0.005,
})

console.log(result.endpoint)
```
