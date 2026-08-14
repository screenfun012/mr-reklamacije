import { describe, expect, it } from 'vitest'

import { freeFieldsFor } from '../intake-free-fields.js'

const T = new Date('2026-08-15T10:00:00Z')

describe('what a signed order still allows', () => {
  it('allows everything before the intake is signed', () => {
    expect(freeFieldsFor(null, null)).toBeNull()
  })

  it('leaves the specification alive between the two signings', () => {
    // The serviser must be able to remove material he does not need (Nikola, 11.08.).
    expect(freeFieldsFor(T, null)).toEqual(['services', 'materials', 'contactPhone'])
  })

  it('closes the specification at handover, and keeps only the phone', () => {
    // contactPhone survives both on purpose: it is never printed, and a wrong number stays wrong
    // after the car leaves.
    expect(freeFieldsFor(T, T)).toEqual(['contactPhone'])
  })
})
