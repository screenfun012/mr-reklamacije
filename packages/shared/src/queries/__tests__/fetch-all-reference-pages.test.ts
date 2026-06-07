import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchAllReferencePages } from '../fetch-all-reference-pages.js'

describe('fetchAllReferencePages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches all pages until nextCursor is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{ id: '1' }],
            nextCursor: 'cursor-2',
            hasMore: true,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{ id: '2' }],
            nextCursor: null,
            hasMore: false,
          }),
        }),
    )

    const items = await fetchAllReferencePages<{ id: string }>('/api/customers', {
      activeOnly: true,
    })

    expect(items).toEqual([{ id: '1' }, { id: '2' }])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
