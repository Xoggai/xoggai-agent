const apiBase = process.env.XOGGAI_API_BASE || 'http://localhost:3000'
const betaKey = process.env.BETA_EXECUTION_KEY
const endpointId = process.env.TEST_ENDPOINT_ID
const budget = Number(process.env.TEST_EXECUTION_BUDGET || '0.05')

if (!betaKey || betaKey.length < 32) {
  throw new Error('BETA_EXECUTION_KEY must contain at least 32 characters')
}

if (!endpointId) {
  throw new Error('TEST_ENDPOINT_ID is required')
}

if (!Number.isFinite(budget) || budget <= 0) {
  throw new Error('TEST_EXECUTION_BUDGET must be a positive number')
}

const response = await fetch(`${apiBase.replace(/\/$/, '')}/execute`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-beta-key': betaKey,
  },
  body: JSON.stringify({
    intent: 'what is the ETH price?',
    endpointId,
    budget,
    mode: 'simulation',
  }),
})

const body = await response.json()

if (body.paymentSent !== false) {
  throw new Error('Safety assertion failed: paymentSent must be false')
}

if (!response.ok || body.simulationPassed !== true) {
  throw new Error(
    `Simulation failed (${response.status}): ${JSON.stringify(body)}`,
  )
}

console.log(
  JSON.stringify(
    {
      status: response.status,
      requestId: body.requestId,
      simulationPassed: body.simulationPassed,
      liveExecutionEnabled: body.liveExecutionEnabled,
      paymentSent: body.paymentSent,
      endpointId: body.endpoint?.id,
    },
    null,
    2,
  ),
)
