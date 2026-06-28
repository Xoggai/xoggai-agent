# Codex Agent Instructions

Use XoggAI as a dry-run-first x402 intent router.

When asked to connect an agent:

1. Read `https://xoggai-agent.com/skill.md`.
2. Use `https://xoggai-agent.com/openapi.json` for endpoint shape.
3. Call `/intent` with `dry=true` before any execution flow.
4. Show endpoint name, price, rating, latency, schema, and budget fit.
5. Keep beta keys, admin keys, and wallet keys outside client-side code.
6. Treat execution as Base Sepolia testnet-only and operator-approved.
7. Treat mainnet execution as disabled until the mainnet migration phase is complete.

Example:

```ts
import { routeIntent } from './xoggai-sdk.js';

const result = await routeIntent('what is the ETH price?', {
  budget: 0.005,
});

console.log(result.endpoint);
```

If a user asks for live execution, create or direct them to a beta request flow.
Do not bypass the beta console, operator approval, request expiry, budget caps,
or endpoint allowlist.
