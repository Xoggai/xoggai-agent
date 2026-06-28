# XoggAI Utility Reference

This file is the quick utility sheet for working on XoggAI locally, deploying it, checking production, and operating the current public testnet beta.

## Core URLs

- Website: `https://xoggai-agent.com`
- Docs UI: `https://xoggai-agent.com/docs`
- Beta console: `https://xoggai-agent.com/beta/`
- Operator console: `https://xoggai-agent.com/admin/`
- Connect agent kit: `https://xoggai-agent.com/connect-agent/`
- Backend API: `https://xoggai-backend.onrender.com`
- GitHub repo: `https://github.com/Xoggai/xoggai-agent`
- Netlify project: `https://app.netlify.com/projects/extraordinary-paletas-651b01`

## Identity Checks

Use these before commits/deploys:

```powershell
git config --local user.name
git config --local user.email
git config --global user.name
git config --global user.email
gh auth status
npx --yes netlify-cli status
```

Expected Git identity:

```text
Xoggai
agentxoggai100@gmail.com
```

Expected remote:

```powershell
git remote -v
```

```text
https://github.com/Xoggai/xoggai-agent.git
```

## Local Development

Install dependencies:

```powershell
npm install
```

Start local database/cache:

```powershell
docker compose up -d db redis
```

Initialize database:

```powershell
npm run db:local:init
npm run seed
```

Run backend:

```powershell
npm run dev
```

Serve frontend:

```powershell
npm run frontend:serve
```

## Release Checks

Run before production-facing push:

```powershell
npm test
npm audit --omit=dev
npm run production:check
npm run phase14:qa
git diff --check
```

Current target result:

```text
production-grade testnet beta ready
```

## Live Smoke Checks

Backend:

```powershell
curl.exe https://xoggai-backend.onrender.com/health
curl.exe https://xoggai-backend.onrender.com/ready
curl.exe https://xoggai-backend.onrender.com/api/info
curl.exe https://xoggai-backend.onrender.com/api/execution-status
```

Frontend:

```powershell
curl.exe -I https://xoggai-agent.com/
curl.exe -I https://xoggai-agent.com/docs
curl.exe -I https://xoggai-agent.com/connect-agent/
curl.exe -I https://xoggai-agent.com/beta/
```

Dry-run route:

```powershell
curl.exe "https://xoggai-backend.onrender.com/intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true"
```

## Git Workflow

Check worktree:

```powershell
git status --short
```

Commit:

```powershell
git add <files>
git commit -m "Clear short message"
```

Push:

```powershell
git push origin main
```

Do not force push unless explicitly approved.

## Netlify Utility

Check current Netlify login and linked project:

```powershell
npx --yes netlify-cli status
```

Wait for GitHub-triggered deploy:

```powershell
npx --yes netlify-cli watch
```

Manual production deploy from static frontend:

```powershell
npx --yes netlify-cli deploy --prod --dir frontend --no-build --site dfb1b703-ea0e-4eb9-a9f9-1fa8f559c18c
```

Use manual deploy only when a small static frontend change must go live immediately.

## Render Utility

Backend URL:

```text
https://xoggai-backend.onrender.com
```

Render service:

```text
xoggai-backend
```

Important status endpoints:

```text
/health
/ready
/api/info
/api/execution-status
```

## Public Beta Utility

Create/check beta users and requests with:

```powershell
npm run phase7:admin -- users
npm run phase7:admin -- requests REQUESTED
```

The public beta console is:

```text
https://xoggai-agent.com/beta/
```

Public beta rules:

- users need invite/API access
- requests start as controlled beta requests
- execution is not permissionless
- browser code never receives wallet keys

## Operator Utility

Check x402 operator status:

```powershell
npm run x402:operator -- status
```

Prepare ticket:

```powershell
$env:TEST_X402_BUDGET='0.005'
npm run x402:operator -- prepare
```

Approve ticket:

```powershell
npm run x402:operator -- approve <ticket-id>
```

Consume ticket:

```powershell
npm run x402:operator -- consume <ticket-id>
```

Execute approved beta request on Base Sepolia:

```powershell
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run phase9:execute -- <request-id>
```

Operator safety rules:

- use Base Sepolia only
- keep `ALLOW_LIVE_EXECUTION=false`
- keep mainnet disabled
- do not bypass approval, expiry, budget caps, idempotency, or allowlist checks
- unknown payment/upstream states must not be retried automatically

## Important Environment Flags

```text
PUBLIC_BETA_ENABLED=true
OPERATIONS_KILL_SWITCH=false
ALLOW_LIVE_EXECUTION=false
X402_NETWORK=base-sepolia
X402_PREPARE_ENABLED=true
X402_SIGNING_ENABLED=true
X402_VERIFY_ENABLED=true
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=true
MAX_EXECUTION_BUDGET_USDC=0.005
```

Emergency stop:

```text
OPERATIONS_KILL_SWITCH=true
```

Disable public beta mutations:

```text
PUBLIC_BETA_ENABLED=false
```

## Writer / Social Utility

Writer context file:

```text
knowledge/xoggai-context.md
```

Canonical public message:

```text
XoggAI is live as a production-grade public testnet beta on Base Sepolia.
Mainnet remains disabled until a separate migration phase.
```

Do not claim:

- mainnet is live
- self-serve mainnet payment is enabled
- guaranteed token price movement
- risk-free execution

## Verification Tags

Virtual Protocol site verification is in `frontend/index.html`:

```html
<meta name="virtual-protocol-site-verification" content="436a5597c538a093aa71b9b1fc77eec7" />
```

## Troubleshooting

### GitHub CLI still wrong account

```powershell
gh auth status
gh auth logout -h github.com -u <wrong-user>
gh auth login
```

### Netlify CLI still wrong account

```powershell
npx --yes netlify-cli logout
npx --yes netlify-cli login
npx --yes netlify-cli status
```

### Render deploy failed at `npm ci`

Check:

- `package-lock.json` is committed
- Dockerfile copies `package*.json`
- Node version supports current lockfile
- run `npm install` locally if lockfile is out of sync

### Verification page cannot see latest frontend change

Options:

1. Wait for GitHub-triggered Netlify deploy.
2. Run `npx --yes netlify-cli watch`.
3. For urgent static changes, deploy manually:

```powershell
npx --yes netlify-cli deploy --prod --dir frontend --no-build --site dfb1b703-ea0e-4eb9-a9f9-1fa8f559c18c
```

## Current Next Best Step

After testnet completion, the recommended next project phase is:

```text
Phase 15: Beta User Feedback Loop
```

See [ROADMAP.md](ROADMAP.md).