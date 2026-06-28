# Phase 12 Developer Integration Kit

Phase 12 makes XoggAI easier to integrate from external agents, scripts, and
developer tools.

The integration kit remains testnet-first. Public routing is dry-run by
default, while controlled Base Sepolia execution still requires beta access,
request expiry, endpoint allowlisting, budget caps, and operator approval.

## Kit Contents

- JavaScript SDK-style helper
- curl examples
- Claude, Codex, and Cursor agent instructions
- production-ready `skill.md`
- clearer `llms.txt`
- OpenAPI schema entries for public, beta, and operator flows
- public docs UI with quickstart, beta console guide, developer kit, API surface, FAQ, and raw agent files
- `/connect-agent/` docs page

## User Flow

1. User opens `https://xoggai-agent.com/beta/`.
2. User signs in with an issued beta key.
3. User writes an intent and budget.
4. XoggAI dry-runs route selection and creates a queued request.
5. User tracks request status and proof from the beta console.

## Developer Flow

1. Call `GET /intent` with a natural-language intent and `dry=true`.
2. Inspect the selected endpoint, price, rating, latency, schema, and budget fit.
3. Keep the flow dry-run-only for normal discovery.
4. For beta execution, create a request from `/beta/` or trusted backend code.
5. Operator reviews and executes on Base Sepolia from `/admin/` or trusted CLI tooling.
6. User or agent reads the lifecycle proof.

## Operator Flow

1. Review queued requests.
2. Reject unsafe, expired, over-budget, or non-allowlisted requests.
3. Approve valid requests.
4. Execute approved requests only on Base Sepolia.
5. Verify proof fields and transaction references.

## Safety Boundary

- `GET /intent` never sends payment.
- Browser examples never include beta, admin, or wallet keys.
- Server examples treat beta keys as secrets.
- Testnet execution remains Base Sepolia only.
- Mainnet remains disabled.
- Idempotency keys prevent duplicate beta request creation.
- Request expiry and endpoint allowlists are part of the public beta boundary.

## Files

- `frontend/docs.html`
- `frontend/connect-agent.html`
- `frontend/examples/xoggai-sdk.js`
- `frontend/examples/curl.md`
- `frontend/examples/claude.md`
- `frontend/examples/codex.md`
- `frontend/examples/cursor.md`
- `frontend/examples/xoggai-agent-starter.ts`
- `frontend/skill.md`
- `frontend/llms.txt`
- `frontend/openapi.json`

## Completion Criteria

- Developers can copy a working JS helper.
- Developers can copy working curl commands.
- Agent tools can read `skill.md`, `llms.txt`, and `openapi.json`.
- `/docs` explains quickstart, beta console, developer integration, API surface, FAQ, and raw agent files.
- `/connect-agent/` renders from Netlify.
- Public examples do not expose secrets.
- Docs state that Base Sepolia is active and mainnet is disabled.
