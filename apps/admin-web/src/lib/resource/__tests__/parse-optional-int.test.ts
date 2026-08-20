import { describe, expect, it } from 'vitest'

import { parseOptionalInt } from '../parse-optional-int'

describe('parseOptionalInt', () => {
  it('reads a whole number and treats an empty field as unset', () => {
    expect(parseOptionalInt('30')).toBe(30)
    expect(parseOptionalInt('  30  ')).toBe(30)
    expect(parseOptionalInt('')).toBeUndefined()
    expect(parseOptionalInt('   ')).toBeUndefined()
  })

  it('rejects a separated number instead of truncating it to its first digits', () => {
    // Number.parseInt('1.998') is 1 — a sort order typed with a thousands separator would
    // silently become a different number, which is the reason this function exists.
    expect(parseOptionalInt('1.998')).toBeUndefined()
    expect(parseOptionalInt('1,998')).toBeUndefined()
    expect(parseOptionalInt('1 998')).toBeUndefined()
    expect(parseOptionalInt('abc')).toBeUndefined()
  })
})
