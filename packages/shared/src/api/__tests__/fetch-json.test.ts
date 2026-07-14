/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { ApiError } from '../api-error.js'
import { fetchJson, fetchParsed } from '../fetch-json.js'

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
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

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/emotive-claims',
      expect.objectContaining({
        credentials: 'include',
      }),
    )
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
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

describe('fetchParsed', () => {
  const schema = z.object({ id: z.string().uuid(), total: z.number().int() })

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns the schema-validated body on a matching response', async () => {
    const body = { id: '123e4567-e89b-12d3-a456-426614174000', total: 3 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))

    await expect(fetchParsed('/api/thing', schema)).resolves.toEqual(body)
  })

  it('throws when the server response drifts from the schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'not-a-uuid', total: 'oops' }),
      }),
    )

    await expect(fetchParsed('/api/thing', schema)).rejects.toBeInstanceOf(z.ZodError)
  })
})
