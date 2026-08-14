import { describe, expect, it } from 'vitest'

import { buildIntakeDocumentStoragePath } from '../storage.interface.js'

describe('buildIntakeDocumentStoragePath', () => {
  it('keeps the intake path it has always used', () => {
    // Changing this orphans every sealed file already in the bucket.
    expect(buildIntakeDocumentStoragePath('abc', 'intake')).toBe('intake/abc/document.pdf')
  })

  it('gives the handover its own file beside it', () => {
    expect(buildIntakeDocumentStoragePath('abc', 'handover')).toBe('intake/abc/handover.pdf')
  })
})
