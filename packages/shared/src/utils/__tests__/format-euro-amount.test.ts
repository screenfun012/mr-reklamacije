import { describe, expect, it } from 'vitest'

import { formatEuroAmount } from '../format-euro-amount.js'

describe('formatEuroAmount', () => {
  it('formats amounts with Serbian grouping and euro suffix', () => {
    expect(formatEuroAmount(1234.56)).toBe('1.234,56 €')
  })

  it('always shows two decimal places', () => {
    expect(formatEuroAmount(500)).toBe('500,00 €')
  })
})
