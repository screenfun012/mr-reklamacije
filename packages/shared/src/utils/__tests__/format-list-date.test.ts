import { describe, expect, it } from 'vitest'

import { formatListDate } from '../format-list-date.js'

describe('formatListDate', () => {
  it('formats ISO date as dd.MM.yyyy.', () => {
    expect(formatListDate('2026-04-17T12:00:00.000Z')).toBe('17.04.2026.')
  })

  it('returns original value when date part is invalid', () => {
    expect(formatListDate('invalid')).toBe('invalid')
  })
})
