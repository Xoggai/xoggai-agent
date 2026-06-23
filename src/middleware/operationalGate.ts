import { createMiddleware } from 'hono/factory'
import { env } from '../env.js'

export function operationalAvailability(input: {
  killSwitchActive: boolean
  publicBetaEnabled?: boolean
}) {
  if (input.killSwitchActive) {
    return { available: false, reason: 'operations_kill_switch_active' }
  }
  if (input.publicBetaEnabled === false) {
    return { available: false, reason: 'public_beta_temporarily_disabled' }
  }
  return { available: true }
}

function unavailable(c: {
  header: (name: string, value: string) => void
  json: (body: unknown, status: 503) => Response
}, reason: string) {
  c.header('Cache-Control', 'no-store')
  c.header('Retry-After', '300')
  return c.json(
    {
      success: false,
      error: reason,
      retryable: true,
    },
    503,
  )
}

export const executionOperationalGate = createMiddleware(async (c, next) => {
  const availability = operationalAvailability({
    killSwitchActive: env.OPERATIONS_KILL_SWITCH,
  })
  if (!availability.available) {
    return unavailable(c, availability.reason!)
  }
  await next()
})

export const publicBetaOperationalGate = createMiddleware(async (c, next) => {
  const availability = operationalAvailability({
    killSwitchActive: env.OPERATIONS_KILL_SWITCH,
    publicBetaEnabled: env.PUBLIC_BETA_ENABLED,
  })
  if (!availability.available) {
    return unavailable(c, availability.reason!)
  }
  await next()
})
