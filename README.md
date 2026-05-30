# XoggAI Agent

[![Website](https://img.shields.io/badge/website-live-f97316?style=flat-square)](https://xoggai-agent.com)
[![Backend](https://img.shields.io/badge/backend-render-46e3c0?style=flat-square)](https://xoggai-backend.onrender.com)
[![Docs](https://img.shields.io/badge/docs-agent%20files-8aad99?style=flat-square)](https://xoggai-agent.com/docs)
[![Mode](https://img.shields.io/badge/mode-dry--run%20preview-0f2218?style=flat-square)](https://xoggai-agent.com)

XoggAI routes plain-English AI agent intents to ranked x402 API endpoints.

Agents send an intent, receive an endpoint preview with price, latency, rating, URL, and schema, then decide when to move from dry-run routing into wallet-gated execution.

Live site: https://xoggai-agent.com  
Backend API: https://xoggai-backend.onrender.com  
Docs UI: https://xoggai-agent.com/docs

![XoggAI public preview](docs/assets/xoggai-preview.png)

## Quick Test

```powershell
curl.exe https://xoggai-backend.onrender.com/health
curl.exe "https://xoggai-backend.onrender.com/intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true"
```

Expected behavior: dry-run responses only. Public demos do not send payment.

## Current Status

XoggAI is a public preview.

- Live: frontend, backend, terminal demo, docs UI.
- Default mode: dry-run routing.
- Safe by default: no payment is sent during dry-runs.
- Not enabled publicly yet: live x402 payment execution.

## What Connect Agent Means

Connect Agent means connecting an existing agent to XoggAI routing.

It does not deploy a new agent, and it does not make XoggAI pay for the user's API calls.

Typical flow:

```text
existing agent
-> XoggAI /intent?q=...
-> ranked x402 endpoint preview
-> developer/agent decides whether to execute later
```

## How It Works

1. Agent sends a natural-language intent.
2. XoggAI embeds/searches/ranks matching x402 API endpoints.
3. XoggAI returns endpoint metadata in dry-run mode.
4. The caller sees price, latency, rating, URL, and schema before execution.
5. Future live execution requires an intentional wallet and budget path.

## Architecture

```text
frontend terminal/docs
-> backend intent router
-> endpoint index + rating engine
-> dry-run preview response
-> optional future x402 execution path
```

## Public API

Production base URL:

```text
https://xoggai-backend.onrender.com
```

Common endpoints:

```http
GET /
GET /health
GET /intent?q=what%20is%20the%20ETH%20price&budget=0.05&dry=true
GET /search?q=crypto%20price&limit=5&dry=true
GET /api/stats
GET /api/feed
GET /api/endpoints
```

Public agent files:

- https://xoggai-agent.com/skill.md
- https://xoggai-agent.com/llms.txt
- https://xoggai-agent.com/openapi.json

## Terminal Commands

The website terminal is a live dry-run console.

```text
help
health
stats
endpoints
search crypto price
route what is the ETH price?
docs
openapi
clear
```

## Local Development

Install dependencies:

```powershell
npm install
```

Start local Postgres and Redis:

```powershell
docker compose up -d db redis
```

Prepare the local database:

```powershell
npm run db:local:init
npm run seed
```

Run the backend:

```powershell
npm run dev
```

Serve the frontend:

```powershell
npm run frontend:serve
```

## Docker

To run the full local stack in Docker, fill `.env` from `.env.example`, then run:

```powershell
docker compose up --build
```

The `app` service runs migration and seed before starting the API.

## Deployment

Frontend:

- Netlify
- `netlify.toml` publishes `frontend/`

Backend:

- Render Blueprint
- `render.yaml` creates `xoggai-backend`, Postgres, and Redis-compatible key/value service

Important Render environment variables:

```text
ALLOWED_ORIGINS=https://xoggai-agent.com,https://www.xoggai-agent.com,https://your-netlify-site.netlify.app
ANTHROPIC_API_KEY=sk-ant-or-router-key
ANTHROPIC_BASE_URL=https://your-anthropic-compatible-router.example.com
ANTHROPIC_ROUTER_MODEL=claude-sonnet-4-5
ANTHROPIC_RATING_MODEL=claude-haiku-4-5-20251001
X402_WALLET_PRIVATE_KEY=0x...
X402_WALLET_ADDRESS=0x...
ALLOW_LIVE_EXECUTION=false
```

Keep `ALLOW_LIVE_EXECUTION=false` for public demos.

## Repository Map

- `src/` - backend API source.
- `frontend/` - static website, docs UI, public agent files.
- `frontend/examples/` - browser-downloadable starter snippet.
- `examples/` - standalone integration examples.
- `scripts/` - local helper scripts.
- `render.yaml` - Render Blueprint.
- `netlify.toml` - Netlify static deploy config.
