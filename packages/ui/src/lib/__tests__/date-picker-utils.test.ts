import { describe, expect, it } from 'vitest'

import { parseIsoDateValue, toIsoDateValue } from '../date-picker-utils.js'

describe('parseIsoDateValue', () => {
  it('parses YYYY-MM-DD as local calendar date', () => {
    const date = parseIsoDateValue('2026-04-17')
    expect(date).toEqual(new Date(2026, 3, 17))
  })

  it('returns undefined for invalid input', () => {
    expect(parseIsoDateValue('2026-13-40')).toBeUndefined()
    expect(parseIsoDateValue('not-a-date')).toBeUndefined()
  })
})

describe('toIsoDateValue', () => {
  it('serializes local date to YYYY-MM-DD', () => {
    expect(toIsoDateValue(new Date(2026, 3, 17))).toBe('2026-04-17')
  })
})
