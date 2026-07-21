import { describe, expect, it } from 'vitest'

import { isSearchPending } from '../search-state'

describe('isSearchPending', () => {
  it('is false below the search threshold (no search will run)', () => {
    expect(isSearchPending('7', '7', false)).toBe(false)
  })

  it('is true while the debounce still lags the typed query', () => {
    expect(isSearchPending('7167', '71', false)).toBe(true)
  })

  it('is true while the request is fetching', () => {
    expect(isSearchPending('7167', '7167', true)).toBe(true)
  })

  it('is false once the debounce caught up and fetching settled (empty state may show)', () => {
    expect(isSearchPending('7167', '7167', false)).toBe(false)
  })
})
