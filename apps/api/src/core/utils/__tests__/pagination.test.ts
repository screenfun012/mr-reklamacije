import { ERROR_CODE } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  buildPaginatedSlice,
  decodeKeysetCursor,
  encodeKeysetCursor,
  parseOptionalKeysetCursor,
} from '../../../core/utils/pagination.js'
import { ValidationError } from '../../../core/errors/domain-errors.js'

describe('pagination utilities', () => {
  it('encodes and decodes keyset cursor', () => {
    const encoded = encodeKeysetCursor({ primary: 'ABC', id: '00000000-0000-4000-8000-000000000001' })
    expect(decodeKeysetCursor(encoded)).toEqual({
      primary: 'ABC',
      id: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('builds paginated slice with hasMore flag', () => {
    const rows = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
      { id: '3', name: 'C' },
    ]

    const page = buildPaginatedSlice(rows, 2, (row) => ({ primary: row.name, id: row.id }))
    expect(page.items).toHaveLength(2)
    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).not.toBeNull()
  })

  it('throws validation error for invalid cursor', () => {
    expect(() => parseOptionalKeysetCursor('not-a-valid-cursor')).toThrow(ValidationError)
    try {
      parseOptionalKeysetCursor('not-a-valid-cursor')
    } catch (error) {
      expect(error).toMatchObject({ code: ERROR_CODE.ValidationError, status: 400 })
    }
  })
})
