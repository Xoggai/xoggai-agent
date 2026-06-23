# Phase 12 Developer Integration Kit

Phase 12 makes XoggAI easier to integrate from external agents, scripts, and
developer tools.

The integration kit remains testnet-first. Public routing is dry-run by
default, while controlled Base Sepolia execution still requires beta access and
operator approval.

## Kit Contents

- JavaScript SDK-style helper
- curl examples
- Claude, Codex, and Cursor agent instructions
- production-ready `skill.md`
- clearer `llms.txt`
- OpenAPI schema entries for public and beta flows
- `/connect-agent/` docs page

## Developer Flow

1. Call `GET /intent` with a natural-language intent and `dry=true`.
2. Inspect the selected endpoint, price, rating, latency, and schema.
3. Keep the flow dry-run-only for normal discovery.
4. For beta execution, create a request from `/beta/`.
5. Operator reviews and executes on Base Sepolia from `/admin/`.
6. User or agent reads the lifecycle proof.

## Safety Boundary

- `GET /intent` never sends payment.
- Browser examples never include beta or admin keys.
- Server examples treat beta keys as secrets.
- Testnet execution remains Base Sepolia only.
- Mainnet remains disabled.

## Files

- `frontend/connect-agent.html`
- `frontend/examples/xoggai-sdk.js`
- `frontend/examples/curl.md`
- `frontend/examples/claude.md`
- `frontend/examples/codex.md`
- `frontend/examples/cursor.md`
- `examples/xoggai-agent-starter.ts`
- `frontend/skill.md`
- `frontend/llms.txt`
- `frontend/openapi.json`

## Completion Criteria

- Developers can copy a working JS helper.
- Developers can copy working curl commands.
- Agent tools can read `skill.md`, `llms.txt`, and `openapi.json`.
- `/connect-agent/` renders from Netlify.
- Public examples do not expose secrets.
