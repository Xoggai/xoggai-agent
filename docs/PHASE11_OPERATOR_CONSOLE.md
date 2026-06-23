# Phase 11 Operator Console

Phase 11 adds a private operator console for public beta approvals and Base
Sepolia execution.

The goal is to move the operator workflow from CLI-only to a browser workflow
without changing the safety model. The console uses the existing admin API and
requires the server-side `PUBLIC_BETA_ADMIN_KEY`.

## Operator Flow

1. Operator opens `/admin/`.
2. Operator enters the admin key and operator label.
3. Console loads the beta execution queue.
4. Operator reviews intent, user id, endpoint, budget, lifecycle, and proof.
5. Operator approves, rejects, cancels, or executes an approved request on
   Base Sepolia.
6. User sees the final status in `/beta/`.

## Console Features

- private `/admin/` static operator surface
- queue search and status filters
- request detail panel
- lifecycle visualization
- approve, reject, and cancel actions
- execute-testnet action for approved requests
- visible ticket, response hash, payment hash, tx, and error fields
- optional 15 second auto-refresh

## Safety Boundary

- no wallet private key is exposed to browser code
- admin key is stored only in browser session storage
- payment execution remains operator initiated
- execution remains Base Sepolia only
- mainnet remains disabled
- settlement endpoint remains disabled for this product phase

## Required Backend Support

- `X-Admin-Key` is allowed through CORS for the static console.
- Admin request listing supports all lifecycle statuses.
- The console uses the existing:
  - `GET /api/admin/beta/requests`
  - `PATCH /api/admin/beta/requests/:id`
  - `POST /api/admin/beta/requests/:id/execute-testnet`

## Completion Criteria

- `/admin/` renders from Netlify.
- Operator can authenticate with `PUBLIC_BETA_ADMIN_KEY`.
- Operator can filter and inspect requests.
- Operator can approve or reject a `REQUESTED` request.
- Operator can execute an `APPROVED` request on Base Sepolia.
- Existing CLI operator commands continue to work.
