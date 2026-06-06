import { describe, expect, it } from 'vitest'

import { claimYearFromDate } from '../claim-year.js'

describe('claimYearFromDate', () => {
  it('returns UTC calendar year from date_of_claim (server timezone independent)', () => {
    expect(claimYearFromDate(new Date('2026-04-17T10:00:00Z'))).toBe(2026)
    // Still 2025 in UTC; local getFullYear() would be 2026 in CET — production must not depend on TZ
    expect(claimYearFromDate(new Date('2025-12-31T23:00:00Z'))).toBe(2025)
    expect(claimYearFromDate(new Date('2025-06-01'))).toBe(2025)
  })
})
