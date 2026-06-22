# Launch Checklist

Use this before sharing XoggAI publicly or shipping a new launch update.

## GitHub

- Repository description: `Dry-run intent router that connects AI agents to ranked x402 API endpoints.`
- Website: `https://xoggai-agent.com`
- Topics: `ai-agents`, `x402`, `base`, `intent-routing`, `typescript`, `hono`, `netlify`, `render`
- README screenshot renders correctly.
- `SECURITY.md` is visible in the repository.

## Frontend

- `https://xoggai-agent.com` loads over HTTPS.
- Terminal opens and runs `status`, `connect`, `route what is the ETH price?`, and `simulate payment`.
- `https://xoggai-agent.com/docs` loads the Quickstart, Agent snippet, API surface, and Agent files sections.
- Raw files load:
  - `https://xoggai-agent.com/skill.md`
  - `https://xoggai-agent.com/llms.txt`
  - `https://xoggai-agent.com/openapi.json`
- Link preview title, description, and image look correct in X, Discord, or Telegram.

## Backend

- `https://xoggai-backend.onrender.com/` returns service metadata.
- `https://xoggai-backend.onrender.com/health` returns `status: ok`.
- `https://xoggai-backend.onrender.com/api/info` returns public preview mode and `liveExecutionEnabled: false`.
- `https://xoggai-backend.onrender.com/api/execution-status` returns:
  - `liveExecutionEnabled: false`
  - `paymentSigningEnabled: false`
  - `paymentVerificationEnabled: false`
  - `paymentSendingEnabled: false`
- `/intent?q=what%20is%20the%20ETH%20price&dry=true` returns a dry-run route.
- `/search?q=crypto%20price&limit=5&dry=true` returns endpoint candidates.

## Deployment

- Netlify latest production deploy is green.
- Render latest backend deploy is live.
- Render free instance cold-start behavior is acceptable for demo traffic.
- `ALLOW_LIVE_EXECUTION=false` is set for public preview.
- `X402_SIGNING_ENABLED=false`, `X402_VERIFY_ENABLED=false`,
  `X402_SETTLEMENT_ENABLED=false`, and
  `X402_UPSTREAM_EXECUTION_ENABLED=false` are set for public preview.
- `ALLOWED_ORIGINS` includes:
  - `https://xoggai-agent.com`
  - `https://www.xoggai-agent.com`
  - the Netlify fallback URL

## Post-Launch

- Watch Render logs for failed requests.
- Check Netlify deploy logs after every push.
- Test terminal commands after deploy completes.
- Keep announcements framed as `public preview` and `dry-run router live`.

## Pre-Push

- `npm test`
- `npm audit --omit=dev`
- `npm run production:check`
- `git diff --check`
