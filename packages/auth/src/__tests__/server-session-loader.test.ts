/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getRequestHeadersMock = vi.hoisted(() =>
  vi.fn(() => ({
    get: (name: string) =>
      (
        ({
          cookie: 'mrr.session_token=test',
          'cf-connecting-ip': '203.0.113.7',
        }) as Record<string, string | undefined>
      )[name],
  })),
)

/** The Headers instance the loader actually handed to fetch. */
function headersOfCall(mock: ReturnType<typeof vi.mocked<typeof fetch>>): Headers {
  const call = mock.mock.calls[0]
  expect(call).toBeDefined()
  return new Headers(call?.[1]?.headers)
}

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

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/get-session',
      expect.anything(),
    )
    expect(headersOfCall(fetchMock).get('cookie')).toBe('mrr.session_token=test')
    expect(result).toEqual({ user: { roles: ['admin'] } })
  })

  it('forwards the client address so the api does not see SSR calls as anonymous', async () => {
    // Without this the api derives no client IP at all: every server-rendered
    // page load of every user lands in one shared rate-limit bucket, and audit
    // rows record a null actor IP.
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response('null', { status: 200 }))

    await createServerSessionLoader()()

    expect(headersOfCall(fetchMock).get('cf-connecting-ip')).toBe('203.0.113.7')
  })

  it('resolves the API origin from API_INTERNAL_URL at runtime (regression: prod SSR must not hit localhost)', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response('null', { status: 200 }))
    process.env['API_INTERNAL_URL'] = 'http://api.railway.internal:3000'

    await createServerSessionLoader()()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.railway.internal:3000/api/auth/get-session',
      expect.anything(),
    )
    expect(headersOfCall(fetchMock).get('cookie')).toBe('mrr.session_token=test')
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
