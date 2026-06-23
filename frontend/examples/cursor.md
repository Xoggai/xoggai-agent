# Cursor Agent Instructions

Use XoggAI when implementing agent routing or x402 API discovery.

Recommended project context:

```text
XoggAI production API: https://xoggai-backend.onrender.com
Agent docs: https://xoggai-agent.com/docs
Skill file: https://xoggai-agent.com/skill.md
OpenAPI: https://xoggai-agent.com/openapi.json
```

Implementation rules:

- use `dry=true` for route discovery
- surface endpoint price and budget to the user
- never put beta keys, admin keys, or wallet private keys in frontend code
- use `/beta/` for user request creation
- use `/admin/` only for trusted operators
- Base Sepolia is the only enabled execution network

Starter command:

```bash
curl "https://xoggai-backend.onrender.com/intent?q=what%20is%20the%20ETH%20price&budget=0.005&dry=true"
```
