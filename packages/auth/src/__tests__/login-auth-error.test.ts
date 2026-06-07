import { describe, expect, it } from 'vitest'

import { loginAuthErrorKind, loginAuthErrorMessage } from '../route-guards.js'

describe('loginAuthErrorKind', () => {
  it('maps invalid credentials', () => {
    expect(loginAuthErrorKind('INVALID_EMAIL_OR_PASSWORD')).toBe('invalid')
  })

  it('maps rate limit', () => {
    expect(loginAuthErrorKind('RATE_LIMITED')).toBe('rate_limited')
  })

  it('maps unknown codes to generic', () => {
    expect(loginAuthErrorKind(undefined)).toBe('generic')
    expect(loginAuthErrorKind('SOMETHING_ELSE')).toBe('generic')
  })
})

describe('loginAuthErrorMessage', () => {
  const messages = {
    invalid: 'invalid-msg',
    rateLimited: 'rate-msg',
    generic: 'generic-msg',
  }

  it('returns the matching message', () => {
    expect(loginAuthErrorMessage('RATE_LIMITED', messages)).toBe('rate-msg')
    expect(loginAuthErrorMessage('INVALID_EMAIL_OR_PASSWORD', messages)).toBe('invalid-msg')
    expect(loginAuthErrorMessage('X', messages)).toBe('generic-msg')
  })
})
