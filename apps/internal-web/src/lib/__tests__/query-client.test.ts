import { ApiError } from '@mr/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleUnauthorizedSession, signOut, syncServiceWorkerPushUser } = vi.hoisted(() => ({
  handleUnauthorizedSession: vi.fn(),
  signOut: vi.fn(async () => {}),
  syncServiceWorkerPushUser: vi.fn(async () => {}),
}))

vi.mock('@mr/auth/route-guards', () => ({ handleUnauthorizedSession }))
vi.mock('../auth-client.js', () => ({ authClient: { signOut } }))
vi.mock('../register-service-worker.js', () => ({ syncServiceWorkerPushUser }))

import { createQueryClient } from '../query-client.js'

describe('createQueryClient', () => {
  beforeEach(() => vi.clearAllMocks())

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

  it('clears the worker account before signing out after a confirmed 401', async () => {
    const client = createQueryClient()

    await expect(
      client.fetchQuery({
        queryKey: ['expired-session'],
        queryFn: () => Promise.reject(new ApiError('Unauthorized', 401)),
      }),
    ).rejects.toMatchObject({ status: 401 })

    const teardown = handleUnauthorizedSession.mock.calls[0]?.[0] as
      | (() => Promise<unknown>)
      | undefined
    expect(teardown).toBeDefined()
    const order: string[] = []
    syncServiceWorkerPushUser.mockImplementationOnce(async () => {
      order.push('push')
    })
    signOut.mockImplementationOnce(async () => {
      order.push('auth')
    })

    await teardown?.()

    expect(order).toEqual(['push', 'auth'])
  })
})
