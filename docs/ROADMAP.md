# XoggAI Roadmap

This roadmap is the high-level source of truth for where XoggAI is now, what is already complete, and what comes next.

## Current Product Status

XoggAI is complete as a production-grade public testnet beta.

Current boundary:

- Product: live testnet beta
- Network: Base Sepolia
- Mainnet: disabled by design
- Website: `https://xoggai-agent.com`
- Backend: `https://xoggai-backend.onrender.com`
- Public beta console: enabled
- Private operator console: enabled
- Execution: guarded Base Sepolia x402 execution
- Payment safety: dry-run first, approval gated, budget capped, allowlisted

Canonical status document: [TESTNET_PRODUCT_STATUS.md](TESTNET_PRODUCT_STATUS.md).

## Product Thesis

AI agents should not execute blindly.

XoggAI gives agents a controlled path from intent to action:

```text
plain-English intent
-> ranked x402 endpoint preview
-> price / latency / metadata inspection
-> gated execution request
-> operator approval
-> Base Sepolia x402 execution
-> proof and audit trail
```

The current product is testnet-first. The goal is to validate UX, execution safety, endpoint quality, user demand, and operator processes before any mainnet migration.

## Completed Roadmap

### Phase 1: Frontend Product Site

Status: complete

Completed outcomes:

- Public product website
- XoggAI brand presentation
- Live terminal-style demo
- Docs links and agent file entry points
- Clean product navigation
- Social preview and favicon polish

### Phase 2: Backend Foundation

Status: complete

Completed outcomes:

- Backend API scaffold
- Health and readiness endpoints
- Endpoint registry
- Intent route surface
- Search route surface
- Stats/feed/info endpoints
- Render deployment

### Phase 3: Intent Routing And Endpoint Ranking

Status: complete

Completed outcomes:

- Natural-language intent routing
- Endpoint scoring/rating flow
- Dry-run response mode
- Endpoint metadata exposure
- Deterministic local embeddings fallback
- Anthropic-compatible router support

### Phase 4: Production Readiness Baseline

Status: complete

Completed outcomes:

- Render Blueprint
- Netlify deployment
- Production checks
- Security headers
- Docs and launch checklist
- Release gate commands

### Phase 5: Testnet x402 Execution

Status: complete

Completed outcomes:

- Base Sepolia x402 prepare flow
- Ticket lifecycle
- Signing and verification path
- Upstream execution path
- Settlement response capture
- Operator CLI commands

Reference: [PHASE5_TESTNET_EXECUTION.md](PHASE5_TESTNET_EXECUTION.md)

### Phase 6: Closed Beta Controls

Status: complete

Completed outcomes:

- Beta access keys
- Per-key quotas
- Budget reservation
- Scoped beta ledger
- Controlled operator workflow

Reference: [PHASE6_CLOSED_BETA.md](PHASE6_CLOSED_BETA.md)

### Phase 7: Public Beta Console

Status: complete

Completed outcomes:

- Invite-only public beta console
- Hashed API keys
- Session auth
- User request creation
- Operator approval queue

Reference: [PHASE7_PUBLIC_BETA.md](PHASE7_PUBLIC_BETA.md)

### Phase 8: Production Launch Controls

Status: complete

Completed outcomes:

- Dependency readiness
- Structured logging
- Operational kill switch
- Protected operational status
- CI release gates
- Deployment smoke checks
- Backup/recovery procedures

Reference: [PHASE8_PRODUCTION_LAUNCH.md](PHASE8_PRODUCTION_LAUNCH.md)

### Phase 9: Testnet Product Execution

Status: complete

Completed outcomes:

- Approved beta requests can execute on Base Sepolia
- User-visible execution lifecycle
- Ticket ids, hashes, settlement metadata
- Mainnet remains disabled

Reference: [PHASE9_TESTNET_PRODUCT_EXECUTION.md](PHASE9_TESTNET_PRODUCT_EXECUTION.md)

### Phase 10: User Console Upgrade

Status: complete

Completed outcomes:

- Quota progress
- Request search
- Status filters
- Quick intents
- Lifecycle detail views
- Testnet proof display
- Optional auto-refresh

Reference: [PHASE10_USER_CONSOLE_UPGRADE.md](PHASE10_USER_CONSOLE_UPGRADE.md)

### Phase 11: Operator Console

Status: complete

Completed outcomes:

- Private operator console
- Queue review
- Approve/reject/cancel actions
- Base Sepolia execution controls
- Operator-visible lifecycle proof

Reference: [PHASE11_OPERATOR_CONSOLE.md](PHASE11_OPERATOR_CONSOLE.md)

### Phase 12: Developer Integration Kit

Status: complete

Completed outcomes:

- Connect-agent page
- JavaScript helper
- curl examples
- Claude/Codex/Cursor examples
- Production-aligned `skill.md`
- Clearer `llms.txt`
- OpenAPI documentation

Reference: [PHASE12_DEVELOPER_INTEGRATION_KIT.md](PHASE12_DEVELOPER_INTEGRATION_KIT.md)

### Phase 13: Testnet Reliability And Abuse Control

Status: complete

Completed outcomes:

- Identity-aware rate limits
- Idempotency keys
- Replay conflict detection
- Expiring approval requests
- Structured audit context
- Managed endpoint allowlist
- Failure/spike alerts

Reference: [PHASE13_TESTNET_RELIABILITY.md](PHASE13_TESTNET_RELIABILITY.md)

### Phase 14: Testnet Launch QA

Status: complete

Completed outcomes:

- Live E2E QA
- Wallet configuration check
- Backup/restore drill coverage
- Incident drill coverage
- Mobile UI pass
- Docs/onboarding pass
- Final go/no-go criteria

Final result:

```text
production-grade testnet beta ready
```

Reference: [PHASE14_TESTNET_LAUNCH_QA.md](PHASE14_TESTNET_LAUNCH_QA.md)

## Next Roadmap

The testnet product is complete. The next roadmap is about improving adoption, trust, integrations, and then preparing a separate mainnet migration.

### Phase 15: Beta User Feedback Loop

Goal: validate real user usage before changing the execution model.

Scope:

- Invite more controlled beta users
- Collect request patterns and failed intents
- Track endpoint selection quality
- Track user confusion in beta console
- Improve onboarding copy
- Add FAQ from actual user questions
- Add lightweight feedback capture

Success criteria:

- At least several real beta users complete dry-run requests
- At least one controlled Base Sepolia execution flow is repeated successfully
- Top user confusion points are documented and fixed
- No unsafe execution bypass is discovered

### Phase 16: Product Analytics And Operator Visibility

Goal: make usage, failures, and execution health easier to monitor.

Scope:

- Operator dashboard metrics
- Request funnel analytics
- Endpoint performance overview
- Execution success/failure charts
- Budget usage visibility
- Alert history view
- Exportable audit log

Success criteria:

- Operator can understand product health without reading raw logs
- Failed requests are easy to diagnose
- Endpoint quality can be compared over time

### Phase 17: Endpoint Marketplace And Quality Layer

Goal: improve endpoint discovery and make XoggAI feel like an agent execution network.

Scope:

- Endpoint profile pages
- Endpoint categories
- Endpoint quality badges
- Endpoint uptime and latency history
- Endpoint pricing display
- Endpoint allowlist management UI
- Optional endpoint submission flow

Success criteria:

- Users understand which endpoints are available
- Operators can safely manage endpoint availability
- Agents receive better endpoint metadata

### Phase 18: Developer Adoption Kit V2

Goal: make external agent integration easier and more credible.

Scope:

- NPM package or SDK package structure
- Versioned JS/TS client
- Better typed examples
- Agent framework examples
- Copy/paste server integration guide
- Postman/Bruno collection
- Improved OpenAPI examples

Success criteria:

- A developer can connect an agent in under 10 minutes
- Integration examples avoid secrets in browser code
- Docs clearly separate dry-run, beta execution, and future mainnet execution

### Phase 19: Public Narrative And Launch Assets

Goal: make the product easier to explain publicly.

Scope:

- Updated product deck
- Public roadmap summary
- Demo video / GIF clips
- X post content system
- Better screenshots
- Simple explainer page
- More polished GitHub/social preview

Success criteria:

- New users understand XoggAI in one minute
- Public messaging stays honest about testnet status
- `XoggAI + $XOGG` narrative is product-led, not price-led

### Phase 20: Testnet Scale And Resilience

Goal: harden the system for more public testnet usage.

Scope:

- Higher traffic testing
- Queue backpressure checks
- Better retry policy for safe non-payment actions
- More complete incident drills
- Staging environment separation
- Additional endpoint chaos tests
- Rate-limit tuning

Success criteria:

- Product remains stable under beta traffic
- Abuse controls hold under repeated attempts
- Operators have clear rollback and kill-switch procedures

### Phase 21: Mainnet Migration Readiness

Goal: prepare for mainnet without enabling it prematurely.

Scope:

- Mainnet risk audit
- Mainnet endpoint allowlist audit
- Mainnet wallet custody plan
- Mainnet budget policy
- User consent model
- Terms/risk disclosure draft
- Mainnet E2E test plan
- Separate staging-to-mainnet checklist

Success criteria:

- Mainnet migration plan is approved before any mainnet key is configured
- Wallet and budget controls are stricter than testnet
- Mainnet launch has a clear rollback plan

### Phase 22: Mainnet Controlled Beta

Goal: launch mainnet in a limited, capped, controlled mode.

Scope:

- Dedicated mainnet wallet
- Very low initial budget caps
- Small allowlisted endpoint set
- Explicit user consent
- Operator approval remains enabled
- Live audit log monitoring
- Manual rollback procedure

Success criteria:

- First mainnet executions complete with expected cost and proof
- No unexpected spend or duplicate execution
- Mainnet remains controlled until confidence is earned

### Phase 23: Self-Serve Execution Model

Goal: move from operator-approved execution toward safer user-controlled automation.

Scope:

- User-configured policies
- Per-agent budgets
- Per-endpoint limits
- Automatic approval rules
- Wallet/session security review
- Policy simulation before enabling
- Full audit and rollback controls

Success criteria:

- Users can define safe execution rules
- Self-serve execution never bypasses budget or endpoint controls
- Operator approval can be reduced only where policy safety is proven

## Always-On Product Principles

- Dry-run before execution.
- Mainnet stays disabled until an explicit migration phase.
- Never expose private keys in browser code.
- Unknown payment or upstream states are not retried automatically.
- Execution needs approval, budget limits, expiry, idempotency, and allowlists.
- Public messaging must say testnet when the product is testnet.
- `$XOGG` messaging should be product-led, not price-led.

## Current Next Best Step

Recommended next step: Phase 15, beta user feedback loop.

Do not start mainnet migration until real testnet user feedback and operator metrics are reviewed.