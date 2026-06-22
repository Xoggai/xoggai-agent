# Phase 5 Testnet Execution

Phase 5 is the first controlled Base Sepolia paid execution rehearsal.

The goal is to prove the complete operator path once:

```text
prepare -> approve -> consume -> sign -> verify -> execute audited upstream
```

This phase is still closed beta. It must not make paid execution available to
public website users.

## Required Backend Configuration

Set these only on the beta Render backend that will run the test:

```text
ALLOW_LIVE_EXECUTION=false
X402_NETWORK=base-sepolia
X402_PREPARE_ENABLED=true
X402_SIGNING_ENABLED=true
X402_VERIFY_ENABLED=true
X402_SETTLEMENT_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=true
MAX_EXECUTION_BUDGET_USDC=0.005
BETA_EXECUTION_KEY=<operator secret, at least 32 chars>
X402_WALLET_PRIVATE_KEY=<dedicated Base Sepolia private key>
X402_WALLET_ADDRESS=<matching wallet address>
```

Do not paste wallet secrets into chat, docs, GitHub, Netlify, or browser code.
Set them directly in Render environment variables.

## Wallet Requirements

Use a dedicated testnet wallet only.

The wallet must have:

- enough Base Sepolia ETH for gas if the provider requires it
- enough Base Sepolia USDC for one capped x402 request
- no mainnet funds
- no reuse with personal wallets or other products

## Operator Preflight

Run this before preparing any ticket:

```powershell
$env:XOGGAI_API_BASE='https://xoggai-backend.onrender.com'
$env:BETA_EXECUTION_KEY='<operator secret>'
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run phase5:preflight
```

Expected:

- `ready: true`
- `blockedBy: []`
- `safetyMode: testnet-upstream-execution` in the checked status
- standalone settlement remains disabled
- live execution remains disabled
- budget cap is `0.005` USDC or lower

Stop if `phase5-preflight` returns any blocker.

## One-Ticket Execution

Prepare the capped ticket:

```powershell
$env:TEST_X402_BUDGET='0.005'
npm run x402:operator -- prepare
```

Inspect the ticket amount, network, recipient, resource URL, and expiry. Approve
only if they match the audited x402 resource.

Approve:

```powershell
$env:X402_OPERATOR='operator'
npm run x402:operator -- approve <prepared-ticket-id>
```

Consume:

```powershell
npm run x402:operator -- consume <approved-ticket-id>
```

Execute the single audited upstream call:

```powershell
$env:X402_CONFIRM_UPSTREAM_EXECUTION='EXECUTE_X402_BASE_SEPOLIA'
npm run x402:operator -- sign-verify-execute <consumed-ticket-id>
```

Expected success result:

- ticket status `EXECUTED`
- `paymentSigned: true`
- `paymentVerified: true`
- `paymentSent: true`
- upstream HTTP status is recorded
- upstream response hash is recorded
- Base Sepolia transaction hash is recorded from `PAYMENT-RESPONSE`

## Stop Conditions

Stop immediately if any of these occur:

- preflight is not ready
- ticket budget exceeds `0.005` USDC
- wallet address does not match the configured private key
- facilitator verification is invalid for a reason other than expected funding
  setup
- ticket enters `UPSTREAM_UNKNOWN`
- upstream response lacks `PAYMENT-RESPONSE`
- a terminal ticket state is reached

Never retry an executed, failed, or unknown ticket automatically.

## Post-Run Lockdown

After the first successful or inconclusive Phase 5 run, disable the dangerous
flags again:

```text
X402_SIGNING_ENABLED=false
X402_VERIFY_ENABLED=false
X402_UPSTREAM_EXECUTION_ENABLED=false
X402_SETTLEMENT_ENABLED=false
```

Record:

- deploy commit
- operator
- ticket id
- request id
- amount
- resource URL
- verification result
- upstream status
- response hash
- transaction hash, if present
- final ticket status

Keep the public website in dry-run mode until a later public-access phase adds
user billing, wallet controls, limits, and abuse prevention.
