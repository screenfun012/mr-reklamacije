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
    delete process.env['VITE_API_URL']
    process.env['API_INTERNAL_URL'] = 'http://localhost:3000'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env['API_INTERNAL_URL']
    delete process.env['VITE_API_URL']
  })

  it('forwards cookies to the API get-session endpoint', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: { roles: ['admin'] } }), { status: 200 }),
    )

    const load = createServerSessionLoader()
    const result = await load()

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/auth/get-session', {
      headers: { cookie: 'mrr.session_token=test' },
    })
    expect(result).toEqual({ user: { roles: ['admin'] } })
  })

  it('resolves the API origin from API_INTERNAL_URL at runtime (regression: prod SSR must not hit localhost)', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response('null', { status: 200 }))
    process.env['API_INTERNAL_URL'] = 'http://api.railway.internal:3000'

    await createServerSessionLoader()()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.railway.internal:3000/api/auth/get-session',
      {
        headers: { cookie: 'mrr.session_token=test' },
      },
    )
  })

  it('returns null when the API responds with null', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response('null', { status: 200 }))

    const load = createServerSessionLoader()
    await expect(load()).resolves.toBeNull()
  })

  it('returns null when fetch fails so SSR login page still renders', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const load = createServerSessionLoader()
    await expect(load()).resolves.toBeNull()
  })
})
