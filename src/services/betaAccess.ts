import { timingSafeEqual } from 'node:crypto'

export type BetaAccessProfile = {
  id: string
  label: string
  key: string
  enabled: boolean
  maxBudgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
}

export type BetaAccessContext = Omit<BetaAccessProfile, 'key'>

export function betaAccessValid(
  candidate: string | undefined,
  expectedKey: string | undefined,
) {
  if (!candidate || !expectedKey) return false

  const actual = Buffer.from(candidate)
  const expected = Buffer.from(expectedKey)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function normalizeProfile(
  raw: Record<string, unknown>,
  defaults: {
    maxBudgetUsdc: number
    dailyRequestLimit: number
    dailyBudgetUsdc: number
  },
): BetaAccessProfile | undefined {
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const key = typeof raw.key === 'string' ? raw.key : ''
  if (!id || key.length < 32) return undefined

  return {
    id,
    label:
      typeof raw.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : id,
    key,
    enabled: raw.enabled !== false,
    maxBudgetUsdc:
      typeof raw.maxBudgetUsdc === 'number' && raw.maxBudgetUsdc > 0
        ? Math.min(raw.maxBudgetUsdc, defaults.maxBudgetUsdc)
        : defaults.maxBudgetUsdc,
    dailyRequestLimit:
      typeof raw.dailyRequestLimit === 'number' &&
      Number.isInteger(raw.dailyRequestLimit) &&
      raw.dailyRequestLimit > 0
        ? raw.dailyRequestLimit
        : defaults.dailyRequestLimit,
    dailyBudgetUsdc:
      typeof raw.dailyBudgetUsdc === 'number' && raw.dailyBudgetUsdc > 0
        ? raw.dailyBudgetUsdc
        : defaults.dailyBudgetUsdc,
  }
}

export function parseBetaAccessProfiles({
  betaAccessKeys,
  betaExecutionKey,
  maxBudgetUsdc,
  dailyRequestLimit,
  dailyBudgetUsdc,
}: {
  betaAccessKeys?: string
  betaExecutionKey?: string
  maxBudgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
}) {
  const defaults = { maxBudgetUsdc, dailyRequestLimit, dailyBudgetUsdc }
  const profiles: BetaAccessProfile[] = []

  if (betaAccessKeys?.trim()) {
    const parsed = JSON.parse(betaAccessKeys) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error('BETA_ACCESS_KEYS must be a JSON array')
    }
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const profile = normalizeProfile(
          item as Record<string, unknown>,
          defaults,
        )
        if (profile) profiles.push(profile)
      }
    }
  }

  if (profiles.length === 0 && betaExecutionKey) {
    profiles.push({
      id: 'legacy-operator',
      label: 'Legacy Operator',
      key: betaExecutionKey,
      enabled: true,
      ...defaults,
    })
  }

  return profiles
}

export function authenticateBetaAccess({
  candidate,
  betaAccessKeys,
  betaExecutionKey,
  maxBudgetUsdc,
  dailyRequestLimit,
  dailyBudgetUsdc,
}: {
  candidate: string | undefined
  betaAccessKeys?: string
  betaExecutionKey?: string
  maxBudgetUsdc: number
  dailyRequestLimit: number
  dailyBudgetUsdc: number
}): BetaAccessContext | undefined {
  const profiles = parseBetaAccessProfiles({
    betaAccessKeys,
    betaExecutionKey,
    maxBudgetUsdc,
    dailyRequestLimit,
    dailyBudgetUsdc,
  })
  const profile = profiles.find((entry) =>
    betaAccessValid(candidate, entry.key),
  )
  if (!profile || !profile.enabled) return undefined

  const { key: _key, ...context } = profile
  return context
}
