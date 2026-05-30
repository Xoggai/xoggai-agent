# XoggAI Agent

## Folder Map

- `src/` - backend API source.
- `frontend/` - website source. Open `frontend/index.html` while developing.
- `deploy/netlify-site/` - static folder to drag into Netlify Drop.
- `scripts/` - local helper scripts.
- `examples/` - standalone integration examples.
- `dist/` - compiled backend output from `npm run build`.

## Common Commands

```powershell
docker compose up -d db redis
npm run db:local:init
npm run seed
npm run dev
npm run netlify:prepare
```

To run the whole local stack in Docker, fill `.env` from `.env.example`, then run:

```powershell
docker compose up --build
```

The `app` service runs the migration and seed before starting the API.

## Live Deploy

Frontend: deploy this repo to Netlify. The included `netlify.toml` publishes `frontend/`.

Backend: deploy this repo to Render as a Blueprint. `render.yaml` creates:

- `xoggai-backend` - Docker web service.
- `xoggai-db` - Postgres database.
- `xoggai-kv` - Redis-compatible key/value service.

Set these Render environment variables before going public:

```text
ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,https://xoggai.xyz
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://your-anthropic-compatible-router.example.com
ANTHROPIC_ROUTER_MODEL=claude-sonnet-4-5
ANTHROPIC_RATING_MODEL=claude-haiku-4-5-20251001
X402_WALLET_PRIVATE_KEY=0x...
X402_WALLET_ADDRESS=0x...
ALLOW_LIVE_EXECUTION=false
```

Keep `ALLOW_LIVE_EXECUTION=false` for public demos. With that setting, `/intent?dry=true`
works for previews, while paid live execution is blocked until real keys and wallet are ready.

After the backend URL is live, set `window.XOGGAI_API_BASE` in `frontend/config.js`,
commit it, and redeploy Netlify.

For Netlify, upload:

```text
deploy/netlify-site
```
