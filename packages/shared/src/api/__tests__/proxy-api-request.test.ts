/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { proxyApiRequest } from '../proxy-api-request.js'

function stubUpstream(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('proxyApiRequest', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', '')
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:3000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('forwards path and query string to the API origin', async () => {
    const fetchMock = stubUpstream(new Response('{}'))

    await proxyApiRequest(new Request('https://portal.example.com/api/claims?page=2&sort=desc'))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.internal:3000/api/claims?page=2&sort=desc',
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    )
  })

  it('strips hop-by-hop and encoding headers but keeps cookies', async () => {
    const fetchMock = stubUpstream(new Response('{}'))

    await proxyApiRequest(
      new Request('https://portal.example.com/api/health', {
        headers: {
          cookie: 'session=abc',
          connection: 'keep-alive',
          'accept-encoding': 'gzip, br',
          origin: 'https://portal.example.com',
        },
      }),
    )

    const [, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers((init as RequestInit).headers)
    expect(headers.get('cookie')).toBe('session=abc')
    expect(headers.get('origin')).toBe('https://portal.example.com')
    expect(headers.get('connection')).toBeNull()
    expect(headers.get('accept-encoding')).toBeNull()
  })

  it('passes every Set-Cookie header through individually', async () => {
    const upstreamHeaders = new Headers({ 'content-type': 'application/json' })
    upstreamHeaders.append('set-cookie', 'better-auth.session_token=tok1; Path=/; HttpOnly')
    upstreamHeaders.append('set-cookie', 'better-auth.csrf_token=tok2; Path=/; HttpOnly')
    stubUpstream(new Response('{}', { status: 200, headers: upstreamHeaders }))

    const response = await proxyApiRequest(
      new Request('https://portal.example.com/api/auth/sign-in/email', { method: 'POST' }),
    )

    expect(response.headers.getSetCookie()).toEqual([
      'better-auth.session_token=tok1; Path=/; HttpOnly',
      'better-auth.csrf_token=tok2; Path=/; HttpOnly',
    ])
    expect(response.headers.get('content-type')).toBe('application/json')
  })

  it('forwards request bodies for mutating methods with half duplex', async () => {
    const fetchMock = stubUpstream(new Response(null, { status: 201 }))

    await proxyApiRequest(
      new Request('https://portal.example.com/api/emotive-claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"mrNumber":"123/26"}',
      }),
    )

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect((init as { duplex?: string }).duplex).toBe('half')
    expect((init as RequestInit).body).not.toBeNull()
  })

  it('sends no body for GET and preserves upstream status', async () => {
    const fetchMock = stubUpstream(new Response('nope', { status: 404 }))

    const response = await proxyApiRequest(
      new Request('https://portal.example.com/api/claims/missing'),
    )

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect((init as RequestInit).body).toBeUndefined()
    expect(response.status).toBe(404)
    await expect(response.text()).resolves.toBe('nope')
  })

  it('strips transport headers from the upstream response', async () => {
    stubUpstream(
      new Response('{}', {
        headers: {
          'transfer-encoding': 'chunked',
          connection: 'keep-alive',
          'content-type': 'application/json',
        },
      }),
    )

    const response = await proxyApiRequest(new Request('https://portal.example.com/api/health'))

    expect(response.headers.get('transfer-encoding')).toBeNull()
    expect(response.headers.get('connection')).toBeNull()
    expect(response.headers.get('content-type')).toBe('application/json')
  })
})
