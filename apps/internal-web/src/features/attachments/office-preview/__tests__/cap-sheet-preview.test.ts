import { describe, expect, it } from 'vitest'

import { capSheetMatrix } from '../cap-sheet-preview.js'

describe('capSheetMatrix', () => {
  it('returns all rows when under limits', () => {
    const result = capSheetMatrix(
      [
        ['A', 'B'],
        [1, 2],
      ],
      500,
      50,
    )

    expect(result.rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ])
    expect(result.totalRows).toBe(2)
    expect(result.totalCols).toBe(2)
    expect(result.truncated).toBe(false)
  })

  it('caps rows and columns and marks truncated', () => {
    const result = capSheetMatrix(
      [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      ],
      1,
      2,
    )

    expect(result.rows).toEqual([['a', 'b']])
    expect(result.totalRows).toBe(2)
    expect(result.totalCols).toBe(3)
    expect(result.truncated).toBe(true)
  })
})
