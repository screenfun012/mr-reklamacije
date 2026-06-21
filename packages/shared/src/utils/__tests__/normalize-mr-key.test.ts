import { describe, expect, it } from 'vitest'

import { normalizeMrKey } from '../normalize-mr-key.js'

describe('normalizeMrKey', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeMrKey(null)).toBeNull()
    expect(normalizeMrKey(undefined)).toBeNull()
    expect(normalizeMrKey('')).toBeNull()
    expect(normalizeMrKey('   ')).toBeNull()
  })

  it('trims edges and collapses internal whitespace', () => {
    expect(normalizeMrKey('  MR  5376 /  25  ')).toBe('mr 5376 / 25')
    expect(normalizeMrKey('Test\t123')).toBe('test 123')
  })

  it('is case-insensitive without stripping MR prefix', () => {
    expect(normalizeMrKey('MR5376')).toBe('mr5376')
    expect(normalizeMrKey('mr5376')).toBe('mr5376')
    expect(normalizeMrKey('5376')).toBe('5376')
    expect(normalizeMrKey('MR5376')).not.toBe(normalizeMrKey('5376'))
  })
})
