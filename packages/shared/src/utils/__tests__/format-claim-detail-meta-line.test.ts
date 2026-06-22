import { describe, expect, it } from 'vitest'

import { formatClaimDetailMetaLine } from '../format-claim-detail-meta-line.js'

describe('formatClaimDetailMetaLine', () => {
  it('joins non-empty parts with middle dots', () => {
    expect(formatClaimDetailMetaLine(['SELMAN', 'BMW N47', '17.04.2026.'])).toBe(
      'SELMAN · BMW N47 · 17.04.2026.',
    )
  })

  it('skips null, undefined, empty, and whitespace-only parts', () => {
    expect(formatClaimDetailMetaLine(['Kupac', null, undefined, '', '   ', '15.06.2026.'])).toBe(
      'Kupac · 15.06.2026.',
    )
  })

  it('returns empty string when all parts are missing', () => {
    expect(formatClaimDetailMetaLine([null, undefined, ''])).toBe('')
  })
})
