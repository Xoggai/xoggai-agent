import assert from 'node:assert/strict'
import { executionStatusRoute } from './executionStatus.js'

const response = await executionStatusRoute.request('/')
const json = (await response.json()) as Record<string, unknown>

assert.equal(response.status, 200)
assert.equal(json.status, 'ok')
assert.equal(json.defaultExecution, 'dry-run')
assert.equal(json.dryRunEnabled, true)
assert.equal(json.liveExecutionEnabled, false)
assert.equal(json.paymentSigningEnabled, false)
assert.equal(json.paymentSendingEnabled, false)
assert.equal(json.safetyMode, process.env.X402_PREPARE_ENABLED === 'true' ? 'ticket-rehearsal' : 'dry-run-preview')

const guardrails = json.guardrails as Record<string, unknown>
assert.equal(guardrails.paymentRequiresApprovedTicket, true)
assert.equal(guardrails.approvedTicketMustBeConsumed, true)
assert.equal(guardrails.dryRunsNeverSendPayment, true)

console.log('execution status route tests passed')
