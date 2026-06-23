import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function assertIncludes(file, expected) {
  assert.ok(
    read(file).includes(expected),
    `${file} must include ${JSON.stringify(expected)}`,
  )
}

function assertNotIncludes(file, unexpected) {
  assert.ok(
    !read(file).includes(unexpected),
    `${file} must not include ${JSON.stringify(unexpected)}`,
  )
}

function assertRenderValue(file, key, value) {
  const yaml = read(file)
  const pattern = new RegExp(
    `- key: ${key}\\s+value: ${JSON.stringify(value)}`,
    'm',
  )
  assert.ok(pattern.test(yaml), `${file} must set ${key}=${value}`)
}

const requiredFiles = [
  'README.md',
  'SECURITY.md',
  'netlify.toml',
  'render.yaml',
  'render.beta.yaml',
  'frontend/index.html',
  'frontend/config.js',
  'frontend/openapi.json',
  'frontend/skill.md',
  'frontend/llms.txt',
  'docs/LAUNCH_CHECKLIST.md',
  'docs/CLOSED_BETA_CHECKLIST.md',
  'docs/OPERATOR_RUNBOOK.md',
  'docs/X402_EXECUTION_PLAN.md',
  'docs/PRODUCTION_READINESS.md',
  'docs/PHASE6_CLOSED_BETA.md',
  'docs/PHASE7_PUBLIC_BETA.md',
  'frontend/beta/index.html',
]

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `${file} must exist`)
}

JSON.parse(read('frontend/openapi.json'))

assertIncludes('netlify.toml', 'publish = "frontend"')
assertIncludes('netlify.toml', 'for = "/config.js"')
assertIncludes('netlify.toml', 'Cache-Control = "no-store"')

for (const key of [
  'ALLOW_LIVE_EXECUTION',
  'EXECUTION_SIMULATION_ENABLED',
  'X402_PREPARE_ENABLED',
  'X402_SIGNING_ENABLED',
  'X402_VERIFY_ENABLED',
  'X402_SETTLEMENT_ENABLED',
  'X402_UPSTREAM_EXECUTION_ENABLED',
]) {
  assertRenderValue('render.yaml', key, 'false')
}

for (const key of [
  'X402_SIGNING_ENABLED',
  'X402_VERIFY_ENABLED',
  'X402_SETTLEMENT_ENABLED',
  'X402_UPSTREAM_EXECUTION_ENABLED',
]) {
  assertRenderValue('render.beta.yaml', key, 'false')
}

assertRenderValue('render.beta.yaml', 'ALLOW_LIVE_EXECUTION', 'false')
assertRenderValue('render.beta.yaml', 'X402_PREPARE_ENABLED', 'true')

assertNotIncludes('frontend/index.html', 'BETA_EXECUTION_KEY')
assertNotIncludes('frontend/config.js', 'BETA_EXECUTION_KEY')
assertNotIncludes('frontend/index.html', 'BETA_ACCESS_KEYS')
assertNotIncludes('frontend/config.js', 'BETA_ACCESS_KEYS')
assertNotIncludes('frontend/beta/index.html', 'PUBLIC_BETA_ADMIN_KEY')
assertNotIncludes('frontend/beta/index.html', 'X402_WALLET_PRIVATE_KEY')
assertNotIncludes('frontend/beta/index.html', 'BETA_EXECUTION_KEY')
assertIncludes('frontend/config.js', 'https://xoggai-backend.onrender.com')

assertIncludes('README.md', 'Public Preview Boundary')
assertIncludes('README.md', 'X402_UPSTREAM_EXECUTION_ENABLED=false')
assertIncludes('SECURITY.md', 'ALLOW_LIVE_EXECUTION=false')
assertIncludes('docs/OPERATOR_RUNBOOK.md', 'X402_UPSTREAM_EXECUTION_ENABLED=false')
assertIncludes('docs/CLOSED_BETA_CHECKLIST.md', 'Unknown upstream execution results are never retried automatically.')
assertIncludes('docs/PRODUCTION_READINESS.md', 'Phase 4')
assertIncludes('docs/PHASE6_CLOSED_BETA.md', 'Ticket Ownership')
assertIncludes('docs/PHASE7_PUBLIC_BETA.md', 'API keys are generated')

console.log('production readiness checks passed')
