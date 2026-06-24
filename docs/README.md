# XoggAI Documentation

This folder contains the product, operations, and launch documentation for
XoggAI.

Current canonical status:

- XoggAI is a production-grade public testnet beta.
- Network is Base Sepolia.
- Mainnet execution is disabled.
- Public routing is dry-run-first.
- Controlled execution requires beta access, operator approval, request expiry,
  budget caps, and allowlisted endpoints.

## Start Here

- [Testnet product status](TESTNET_PRODUCT_STATUS.md)
- [Production readiness](PRODUCTION_READINESS.md)
- [Launch checklist](LAUNCH_CHECKLIST.md)
- [Security model](../SECURITY.md)
- [GitHub repository profile](GITHUB_PROFILE.md)
- [Deployment guide](DEPLOYMENT.md)

## Product Phases

- [Phase 5: Testnet execution](PHASE5_TESTNET_EXECUTION.md)
- [Phase 6: Closed beta](PHASE6_CLOSED_BETA.md)
- [Phase 7: Public beta](PHASE7_PUBLIC_BETA.md)
- [Phase 8: Production launch controls](PHASE8_PRODUCTION_LAUNCH.md)
- [Phase 9: Testnet product execution](PHASE9_TESTNET_PRODUCT_EXECUTION.md)
- [Phase 10: User console upgrade](PHASE10_USER_CONSOLE_UPGRADE.md)
- [Phase 11: Operator console](PHASE11_OPERATOR_CONSOLE.md)
- [Phase 12: Developer integration kit](PHASE12_DEVELOPER_INTEGRATION_KIT.md)
- [Phase 13: Testnet reliability](PHASE13_TESTNET_RELIABILITY.md)
- [Phase 14: Testnet launch QA](PHASE14_TESTNET_LAUNCH_QA.md)

## Runbooks

- [Operator runbook](OPERATOR_RUNBOOK.md)
- [Backup and recovery](BACKUP_RECOVERY.md)
- [Incident response](INCIDENT_RESPONSE.md)
- [Beta endpoint audit](BETA_ENDPOINT_AUDIT.md)
- [Closed beta checklist](CLOSED_BETA_CHECKLIST.md)
- [x402 execution plan](X402_EXECUTION_PLAN.md)

## Developer Integration

- Website docs: `https://xoggai-agent.com/docs`
- Connect agent page: `https://xoggai-agent.com/connect-agent/`
- OpenAPI: `https://xoggai-agent.com/openapi.json`
- Agent skill: `https://xoggai-agent.com/skill.md`
- LLM context: `https://xoggai-agent.com/llms.txt`

Local files:

- `frontend/openapi.json`
- `frontend/skill.md`
- `frontend/llms.txt`
- `frontend/examples/xoggai-sdk.js`
- `frontend/examples/curl.md`
- `frontend/examples/claude.md`
- `frontend/examples/codex.md`
- `frontend/examples/cursor.md`

## Release Checks

Run before production-facing changes:

```powershell
npm test
npm audit --omit=dev
npm run production:check
npm run phase14:qa
git diff --check
```

The target launch result is:

```text
production-grade testnet beta ready
```
