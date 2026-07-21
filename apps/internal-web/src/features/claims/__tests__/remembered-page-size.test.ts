import { beforeEach, describe, expect, it } from 'vitest'

import {
  CLAIMS_PAGE_SIZE_STORAGE_KEY,
  pageSizeToRestore,
  readRememberedPageSize,
  writeRememberedPageSize,
} from '../remembered-page-size'

describe('remembered page size storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a written page size', () => {
    writeRememberedPageSize(50)
    expect(readRememberedPageSize()).toBe(50)
  })

  it('returns null when nothing is stored', () => {
    expect(readRememberedPageSize()).toBeNull()
  })

  it('returns null for an invalid stored value', () => {
    window.localStorage.setItem(CLAIMS_PAGE_SIZE_STORAGE_KEY, '999')
    expect(readRememberedPageSize()).toBeNull()
  })
})

describe('pageSizeToRestore', () => {
  it('does not restore when the URL already specifies a page size', () => {
    expect(pageSizeToRestore(true, 50, 10)).toBeNull()
  })

  it('restores the remembered size when the URL has none', () => {
    expect(pageSizeToRestore(false, 50, 10)).toBe(50)
  })

  it('does not restore when nothing is remembered', () => {
    expect(pageSizeToRestore(false, null, 10)).toBeNull()
  })

  it('does not restore when the remembered size equals the current size', () => {
    expect(pageSizeToRestore(false, 10, 10)).toBeNull()
  })
})
