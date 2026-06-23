# Changelog

## 2026-06-23

- Added Phase 6 multi-agent closed-beta access profiles.
- Added per-key request budgets, daily request quotas, and daily budget quotas.
- Bound payment tickets to their creating beta key identity.
- Added a scoped beta execution ledger at `/api/beta/executions`.
- Added atomic PostgreSQL quota reservation to prevent concurrent limit bypass.
- Added one-shot Phase 6 execution and scoped ledger operator commands.
- Added the Phase 7 invite-only beta console, hashed API keys, sessions, and
  operator approval queue.

## 2026-05-31

- Added a docs UI for `skill.md`, `llms.txt`, and `openapi.json`.
- Expanded the website terminal with `endpoints`, `search`, `docs`, and `openapi` commands.
- Clarified the public preview flow: dry-run routing first, live execution gated.
- Added a README preview screenshot and backend root route for easier project inspection.
- Added README badges, quick-test commands, and social preview metadata.
- Expanded the docs UI with quickstart, execution model, API surface, and agent file sections.
- Upgraded the website terminal with connect, status, price, explain, and payment simulation commands.
- Added backend `/api/info`, a homepage safety section, and a copyable docs agent snippet.
- Added security notes, launch checklist, and recommended GitHub About metadata.
