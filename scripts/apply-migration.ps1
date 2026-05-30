$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$migration = Join-Path $repoRoot 'src\db\migrations\0000_initial.sql'

Get-Content -Raw $migration | docker compose exec -T db psql -U xoggai -d xoggai
