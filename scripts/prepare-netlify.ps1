$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$frontend = Join-Path $repoRoot 'frontend'
$target = Join-Path $repoRoot 'deploy\netlify-site'

New-Item -ItemType Directory -Force -Path $target | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target 'examples') | Out-Null

Copy-Item -LiteralPath (Join-Path $frontend 'index.html') -Destination (Join-Path $target 'index.html') -Force
Copy-Item -LiteralPath (Join-Path $frontend 'config.js') -Destination (Join-Path $target 'config.js') -Force
Copy-Item -LiteralPath (Join-Path $frontend 'skill.md') -Destination (Join-Path $target 'skill.md') -Force
Copy-Item -LiteralPath (Join-Path $frontend 'llms.txt') -Destination (Join-Path $target 'llms.txt') -Force
Copy-Item -LiteralPath (Join-Path $frontend 'openapi.json') -Destination (Join-Path $target 'openapi.json') -Force
Copy-Item -LiteralPath (Join-Path $frontend 'examples\xoggai-agent-starter.ts') -Destination (Join-Path $target 'examples\xoggai-agent-starter.ts') -Force

Write-Host "Netlify site prepared at $target"
