import { timingSafeEqual } from 'node:crypto'

export function betaAccessValid(
  candidate: string | undefined,
  expectedKey: string | undefined,
) {
  if (!candidate || !expectedKey) return false

  const actual = Buffer.from(candidate)
  const expected = Buffer.from(expectedKey)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
