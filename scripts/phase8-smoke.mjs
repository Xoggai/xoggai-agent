import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

async function request(fetchImpl, url, expectedContentType) {
  const response = await fetchImpl(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'xoggai-phase8-smoke/1.0' },
  })
  assert.equal(response.ok, true, `${url} returned ${response.status}`)
  const contentType = response.headers.get('content-type') || ''
  assert.match(contentType, expectedContentType, `${url} content type`)
  return response
}

export async function runPhase8Smoke({
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const backend = (
    env.XOGGAI_API_BASE || 'https://xoggai-backend.onrender.com'
  ).replace(/\/$/, '')
  const website = (
    env.XOGGAI_WEBSITE_URL || 'https://xoggai-agent.com'
  ).replace(/\/$/, '')

  const health = await (
    await request(fetchImpl, `${backend}/health`, /json/)
  ).json()
  assert.equal(health.status, 'ok')
  assert.equal(health.service, 'xoggai-backend')

  const ready = await (
    await request(fetchImpl, `${backend}/ready`, /json/)
  ).json()
  assert.equal(ready.ready, true)
  assert.equal(ready.dependencies.database.status, 'ok')
  assert.equal(ready.dependencies.cache.status, 'ok')

  const status = await (
    await request(fetchImpl, `${backend}/api/execution-status`, /json/)
  ).json()
  assert.equal(status.liveExecutionEnabled, false)
  assert.equal(status.paymentSendingEnabled, false)
  assert.equal(status.operationsKillSwitchActive, false)
  assert.equal(status.publicBetaEnabled, true)
  assert.equal(status.publicBetaAdminConfigured, true)

  await request(fetchImpl, `${website}/`, /html/)
  await request(fetchImpl, `${website}/docs`, /html/)
  await request(fetchImpl, `${website}/beta/`, /html/)

  const openapi = await (
    await request(fetchImpl, `${website}/openapi.json`, /json/)
  ).json()
  assert.match(openapi.openapi, /^3\./)

  const result = {
    success: true,
    backend,
    website,
    version: health.version,
    environment: health.environment,
    dependencies: ready.dependencies,
    safetyMode: status.safetyMode,
    paymentSendingEnabled: status.paymentSendingEnabled,
    publicBetaEnabled: status.publicBetaEnabled,
  }
  log(JSON.stringify(result, null, 2))
  return result
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runPhase8Smoke()
}
