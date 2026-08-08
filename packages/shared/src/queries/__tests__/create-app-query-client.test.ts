import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/api-error.js'
import { createAppQueryClient } from '../create-app-query-client.js'

function retryOf(client: QueryClient): (failureCount: number, error: unknown) => boolean {
  const retry = client.getDefaultOptions().queries?.retry
  if (typeof retry !== 'function') {
    throw new Error('the shared client is expected to decide retries with a predicate')
  }
  return retry as (failureCount: number, error: unknown) => boolean
}

describe('createAppQueryClient retry policy', () => {
  const retry = retryOf(createAppQueryClient(vi.fn()))

  /**
   * Each of these four is a definitive answer: asking again cannot change it. 404 is the one that was
   * missing, and its absence was expensive — four requests and 7.7 s of an empty screen before a
   * not-found box appeared, measured on a serviser opening an order that is not his (this API answers
   * 404 rather than 403 there, so as not to leak existence).
   */
  it.each([401, 403, 404, 429])('does not retry a %i', (status) => {
    expect(retry(0, new ApiError('nope', status))).toBe(false)
  })

  it('retries a server error, up to three attempts', () => {
    const error = new ApiError('boom', 500)

    expect(retry(0, error)).toBe(true)
    expect(retry(2, error)).toBe(true)
    expect(retry(3, error)).toBe(false)
  })

  it('retries a transport failure, which carries no status at all', () => {
    expect(retry(0, new Error('network down'))).toBe(true)
  })
})
