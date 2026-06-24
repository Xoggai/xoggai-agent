# Changelog

## 2026-06-24

- Added the Phase 12 developer integration kit at `/connect-agent/`.
- Added a reusable JavaScript routing helper, curl recipes, and integration
  instructions for Claude, Codex, and Cursor.
- Updated `skill.md`, `llms.txt`, OpenAPI metadata, docs, and homepage entry
  points around the dry-run-first Base Sepolia product boundary.
- Added Phase 13 identity rate limits, idempotent request creation, replay
  conflict protection, expiring approvals, structured audit fields, managed
  endpoint allowlisting, and operational reliability alerts.
- Added Phase 14 final testnet launch QA with a live E2E command, wallet
  configuration/funded checks, backup and incident drill coverage, mobile/docs
  audits, and go/no-go criteria for the public Base Sepolia product.

## 2026-06-23

- Added Phase 6 multi-agent closed-beta access profiles.
- Added per-key request budgets, daily request quotas, and daily budget quotas.
- Bound payment tickets to their creating beta key identity.
- Added a scoped beta execution ledger at `/api/beta/executions`.
- Added atomic PostgreSQL quota reservation to prevent concurrent limit bypass.
- Added one-shot Phase 6 execution and scoped ledger operator commands.
- Added the Phase 7 invite-only beta console, hashed API keys, sessions, and
  operator approval queue.
- Added Phase 8 dependency readiness, structured request logging, operational
  kill switches, protected ops status, CI release gates, production smoke
  tests, and database backup/recovery procedures.
- Added Phase 9 public testnet execution: approved beta requests can run
  through the Base Sepolia x402 path with user-visible lifecycle status,
  ticket ids, response hashes, and settlement metadata while mainnet stays off.
- Added Phase 10 user console upgrade with quota progress, request search,
  status filters, quick intents, lifecycle details, proof drawer, and
  auto-refresh for the public beta surface.
- Added Phase 11 operator console at `/admin/` for private queue review,
  approve/reject/cancel actions, Base Sepolia execution, lifecycle proof, and
  operator auto-refresh.

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
