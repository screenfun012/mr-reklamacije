import { describe, expect, it } from 'vitest'

import { computeDomaceTotal } from '../compute-domace-total.js'

describe('computeDomaceTotal', () => {
  it('sums parts and labor', () => {
    expect(computeDomaceTotal(60000, 24500.5)).toBe(84500.5)
  })

  it('returns null when both are empty, so an untouched claim shows no total', () => {
    expect(computeDomaceTotal(null, null)).toBeNull()
    expect(computeDomaceTotal(undefined, undefined)).toBeNull()
  })

  it('treats the missing half as zero when only one is present', () => {
    expect(computeDomaceTotal(60000, null)).toBe(60000)
    expect(computeDomaceTotal(null, 25000)).toBe(25000)
  })

  it('keeps an explicit zero as a real value, not empty', () => {
    expect(computeDomaceTotal(0, null)).toBe(0)
  })
})
