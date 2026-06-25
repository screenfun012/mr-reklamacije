/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api-error.js'
import { fetchNoContent } from '../fetch-no-content.js'

describe('fetchNoContent', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('resolves on 204 without parsing a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    )

    await expect(
      fetchNoContent('/api/engine-types/id', { method: 'DELETE' }),
    ).resolves.toBeUndefined()
  })

  it('throws ApiError on non-2xx JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          error: { code: 'CONFLICT', message: 'Tip motora se koristi u reklamacijama.' },
        }),
      }),
    )

    const rejection = fetchNoContent('/api/engine-types/id', { method: 'DELETE' })
    await expect(rejection).rejects.toBeInstanceOf(ApiError)
    await expect(rejection).rejects.toMatchObject({
      message: 'Tip motora se koristi u reklamacijama.',
      status: 409,
    })
  })
})
