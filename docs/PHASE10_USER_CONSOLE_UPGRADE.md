# Phase 10 User Console Upgrade

Phase 10 upgrades the public beta console into a clearer product surface for
testnet users.

The backend execution model stays the same as Phase 9: requests start with
dry-run routing, require operator approval, and can execute only on Base
Sepolia. Mainnet remains disabled.

## Console Improvements

- quota progress bars for remaining requests and daily budget
- quick intent presets for common routing tests
- request search and status filters
- compact request cards instead of a dense table
- request detail drawer with lifecycle, endpoint, ticket, hash, and tx data
- lifecycle visualization from `REQUESTED` through `EXECUTED`
- clearer failed, approved, testnet, and executed status states
- optional 15 second auto-refresh

## User Flow

1. User signs in with a beta API key.
2. User submits an intent and budget.
3. Console creates a dry-run-backed execution request.
4. Operator approves and executes the request from the admin CLI.
5. User refreshes or enables auto-refresh to see the final testnet proof.

## Safety Boundary

- no wallet keys are exposed in browser code
- users cannot execute payments directly
- all execution remains operator-approved
- all payment execution remains on Base Sepolia
- mainnet payment remains disabled

## Completion Criteria

- `/beta/` renders on desktop and mobile.
- Login, request creation, refresh, filtering, and detail drawer work without
  backend changes.
- Existing Phase 9 API responses continue to power the console.
- Build and production readiness checks pass.
