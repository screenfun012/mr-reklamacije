import { ApiError } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { createQueryClient } from '../query-client.js'

describe('createQueryClient', () => {
  it('does not retry queries that fail with 429', () => {
    const client = createQueryClient()
    const retry = client.getDefaultOptions().queries?.retry

    expect(typeof retry).toBe('function')
    if (typeof retry !== 'function') {
      return
    }

    const rateLimited = new ApiError('Too many requests', 429)
    expect(retry(0, rateLimited)).toBe(false)
    expect(retry(1, rateLimited)).toBe(false)
  })
})
