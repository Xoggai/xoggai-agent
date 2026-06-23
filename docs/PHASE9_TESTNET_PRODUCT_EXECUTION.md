# Phase 9 Testnet Product Execution

Phase 9 makes XoggAI usable as a production beta product while all payment
execution remains on Base Sepolia.

This is not a mainnet launch. The browser never receives wallet keys,
`ALLOW_LIVE_EXECUTION` stays `false`, and operators remain in control of
testnet execution.

## Product Flow

1. User signs in at `/beta/`.
2. User submits a natural-language intent and budget.
3. Backend performs dry-run routing and stores an execution request.
4. Admin reviews and approves the request.
5. Admin runs the approved request through the Base Sepolia x402 lifecycle:
   `PREPARED -> APPROVED -> CONSUMED -> SIGNED -> VERIFIED -> EXECUTED`.
6. User sees lifecycle status and testnet proof in the beta console.

## Production Testnet Flags

```text
X402_NETWORK=base-sepolia
ALLOW_LIVE_EXECUTION=false
X402_PREPARE_ENABLED=true
X402_SIGNING_ENABLED=true
X402_VERIFY_ENABLED=true
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=true
PUBLIC_BETA_ENABLED=true
OPERATIONS_KILL_SWITCH=false
```

`X402_SETTLEMENT_ENABLED=false` is intentional. Phase 9 uses the upstream x402
execution path, which records the upstream payment response and settlement
metadata from the audited Base Sepolia resource.

## Admin Commands

List requested beta executions:

```bash
npm run phase7:admin -- requests REQUESTED
```

Approve a request:

```bash
npm run phase7:admin -- decide <request-id> APPROVED "Reviewed for testnet"
```

Execute an approved request on Base Sepolia:

```bash
npm run phase9:execute -- <request-id>
```

The command returns the updated request, ticket status, upstream status code,
response hash, payment response hash, and settlement transaction when the
audited testnet resource succeeds.

## User Console

The beta console displays:

- request intent and selected endpoint
- budget and endpoint price
- lifecycle status
- payment ticket id
- payment response hash or testnet transaction metadata
- error reason when execution fails

## Completion Criteria

- User can submit a request from the production beta console.
- Admin can approve the request.
- Admin can execute the approved request on Base Sepolia.
- User can refresh the beta console and see the final execution state.
- Mainnet remains disabled.
- Browser code contains no wallet keys, beta execution key, or admin key.
