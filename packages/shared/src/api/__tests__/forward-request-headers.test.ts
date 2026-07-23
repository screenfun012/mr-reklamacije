import { describe, expect, it } from 'vitest'

import { applyForwardedRequestHeaders, CLIENT_IP_HEADER } from '../forward-request-headers.js'

describe('applyForwardedRequestHeaders', () => {
  it('carries the client address across, so SSR calls are not anonymous to the api', () => {
    const target = new Headers()
    const incoming = new Headers({ [CLIENT_IP_HEADER]: '203.0.113.7' })

    applyForwardedRequestHeaders(target, incoming)

    expect(target.get(CLIENT_IP_HEADER)).toBe('203.0.113.7')
  })

  it('carries the cookie across', () => {
    const target = new Headers()
    const incoming = new Headers({ cookie: 'better-auth.session_token=abc' })

    applyForwardedRequestHeaders(target, incoming)

    expect(target.get('cookie')).toBe('better-auth.session_token=abc')
  })

  it('never overrides a header the caller set explicitly', () => {
    const target = new Headers({ cookie: 'deliberate=1' })
    const incoming = new Headers({ cookie: 'ambient=2' })

    applyForwardedRequestHeaders(target, incoming)

    expect(target.get('cookie')).toBe('deliberate=1')
  })

  it('does NOT forward x-forwarded-for (inside the private network it names our own peer)', () => {
    const target = new Headers()
    const incoming = new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.2' })

    applyForwardedRequestHeaders(target, incoming)

    expect(target.get('x-forwarded-for')).toBeNull()
  })

  it('leaves absent and empty headers unset rather than sending blanks', () => {
    const target = new Headers()
    const incoming = new Headers({ [CLIENT_IP_HEADER]: '' })

    applyForwardedRequestHeaders(target, incoming)

    expect(target.get(CLIENT_IP_HEADER)).toBeNull()
    expect(target.get('cookie')).toBeNull()
  })
})
