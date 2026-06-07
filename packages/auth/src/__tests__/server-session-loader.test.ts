/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getRequestHeadersMock = vi.hoisted(() =>
  vi.fn(() => ({
    get: (name: string) => (name === 'cookie' ? 'mrr.session_token=test' : undefined),
  })),
)

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}))

import { createServerSessionLoader } from '../server-session-loader.js'

describe('createServerSessionLoader', () => {
  beforeEach(() => {
    getRequestHeadersMock.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards cookies to the API get-session endpoint', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: { roles: ['admin'] } }), { status: 200 }),
    )

    const load = createServerSessionLoader('http://localhost:3000')
    const result = await load()

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/auth/get-session', {
      headers: { cookie: 'mrr.session_token=test' },
    })
    expect(result).toEqual({ user: { roles: ['admin'] } })
  })

  it('returns null when the API responds with null', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response('null', { status: 200 }))

    const load = createServerSessionLoader('http://localhost:3000')
    await expect(load()).resolves.toBeNull()
  })
})
