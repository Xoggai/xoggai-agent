# Security

XoggAI is currently a public preview. The public deployment is designed to be safe by default.

## Public Preview Mode

- Public routing uses dry-run behavior by default.
- Dry-runs do not send x402 payment.
- Dry-runs do not require callers to expose wallet private keys.
- Live execution is intentionally gated behind backend configuration.

Keep this value disabled for public demos:

```text
ALLOW_LIVE_EXECUTION=false
```

## Sensitive Data

Never commit real secrets, wallet private keys, API keys, database URLs, or Render/Netlify tokens.

Use `.env.example` for placeholders only. Local `.env` files are ignored by git.

## Reporting Issues

If you find a vulnerability or unsafe payment behavior, open a private report to the repository owner instead of posting exploit details publicly.

Please include:

- A short description of the issue.
- Steps to reproduce.
- Whether payment execution, wallet handling, or secret exposure is involved.
- Relevant endpoint, commit, or deployment URL.

## Scope

In scope:

- Backend API behavior.
- Public website and docs.
- Dry-run vs live execution controls.
- Secret handling and deployment configuration.

Out of scope:

- Third-party provider outages.
- Render or Netlify platform issues.
- Browser extensions or local machine malware.

No bug bounty program is currently active.
