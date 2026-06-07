import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api-error.js'
import { fetchJson } from '../fetch-json.js'

describe('fetchJson', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      }),
    )

    await expect(fetchJson<{ items: unknown[] }>('/api/emotive-claims')).resolves.toEqual({
      items: [],
    })

    expect(fetch).toHaveBeenCalledWith('/api/emotive-claims', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('throws ApiError with envelope message on non-2xx JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: { code: 'FORBIDDEN', message: 'Nedozvoljeno' } }),
      }),
    )

    const rejection = fetchJson('/api/emotive-claims')
    await expect(rejection).rejects.toBeInstanceOf(ApiError)
    await expect(rejection).rejects.toMatchObject({
      message: 'Nedozvoljeno',
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('falls back to status text when error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('not json')
        },
      }),
    )

    await expect(fetchJson('/api/emotive-claims')).rejects.toMatchObject({
      message: 'Internal Server Error',
      status: 500,
    })
  })
})
