import { describe, expect, it } from 'vitest'

import { isInternalNotesOnlyUpdate } from '../is-internal-notes-only-update.js'

describe('isInternalNotesOnlyUpdate', () => {
  it('is true when only internalNotes is provided', () => {
    expect(isInternalNotesOnlyUpdate({ internalNotes: 'Nalaz' })).toBe(true)
    expect(isInternalNotesOnlyUpdate({ internalNotes: null })).toBe(true)
  })

  it('is false when other fields are included', () => {
    expect(isInternalNotesOnlyUpdate({ internalNotes: 'Nalaz', mrNumber: '1/26' })).toBe(false)
    expect(isInternalNotesOnlyUpdate({ warrantyReport: 'Razlog' })).toBe(false)
  })
})
