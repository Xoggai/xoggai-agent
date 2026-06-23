import assert from 'node:assert/strict'
import { evaluateReliabilityAlerts } from './reliabilityAlerts.js'

assert.deepEqual(
  evaluateReliabilityAlerts(
    { requestsLast5Minutes: 10, failuresLast15Minutes: 1, expiredLast24Hours: 0, idempotentReplaysLast24Hours: 0 },
    { requestSpike: 50, executionFailures: 5 },
  ),
  [],
)
const alerts = evaluateReliabilityAlerts(
  { requestsLast5Minutes: 50, failuresLast15Minutes: 5, expiredLast24Hours: 2, idempotentReplaysLast24Hours: 3 },
  { requestSpike: 50, executionFailures: 5 },
)
assert.equal(alerts.length, 2)
assert.equal(alerts[0]?.code, 'request_spike')
assert.equal(alerts[1]?.severity, 'critical')

console.log('reliability alert tests passed')
