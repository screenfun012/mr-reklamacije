import { describe, expect, it } from 'vitest'

import { claimYearFromDate } from '../claim-year.js'

describe('claimYearFromDate', () => {
  it('returns calendar year from date_of_claim', () => {
    expect(claimYearFromDate(new Date('2026-04-17T10:00:00Z'))).toBe(2026)
    expect(claimYearFromDate(new Date('2025-12-31T23:00:00Z'))).toBe(2026)
  })
})
