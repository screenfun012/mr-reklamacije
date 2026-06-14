import { describe, expect, it } from 'vitest'

import { formatListDateTime } from '../format-list-date-time.js'

describe('formatListDateTime', () => {
  it('formats ISO timestamp as dd.MM.yyyy. HH:mm in local time', () => {
    const local = new Date(2026, 3, 17, 9, 5)
    expect(formatListDateTime(local.toISOString())).toBe('17.04.2026. 09:05')
  })

  it('returns original value when timestamp is invalid', () => {
    expect(formatListDateTime('invalid')).toBe('invalid')
  })
})
