import { describe, expect, it } from 'vitest'

import { formatTimeAgo } from '../format-time-ago.js'

describe('formatTimeAgo', () => {
  it('writes Serbian in Latin script, never Cyrillic', () => {
    // Bare `sr` resolves to Cyrillic and printed „пре 2 сата" in the notification rows.
    const now = new Date('2026-08-29T12:00:00Z')
    const label = formatTimeAgo('2026-08-29T10:00:00Z', 'sr', now)
    expect(label).toBe('pre 2 sata')
    expect(label).not.toMatch(/\p{Script=Cyrillic}/u)
  })

  it('keeps English untouched', () => {
    const now = new Date('2026-08-29T12:00:00Z')
    expect(formatTimeAgo('2026-08-29T10:00:00Z', 'en', now)).toBe('2 hours ago')
  })
})
