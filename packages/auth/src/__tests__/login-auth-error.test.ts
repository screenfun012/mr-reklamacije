import { describe, expect, it } from 'vitest'

import { AUTH_ERROR_ACCOUNT_PENDING, AUTH_ERROR_ACCOUNT_REJECTED } from '../auth-error-codes.js'
import { loginAuthErrorKind, loginAuthErrorMessage } from '../login-auth-error.js'

describe('loginAuthErrorKind', () => {
  it('maps invalid credentials', () => {
    expect(loginAuthErrorKind('INVALID_EMAIL_OR_PASSWORD')).toBe('invalid')
  })

  it('maps rate limit', () => {
    expect(loginAuthErrorKind('RATE_LIMITED')).toBe('rate_limited')
  })

  it('maps pending approval from hook message token', () => {
    expect(loginAuthErrorKind('UNAUTHORIZED', AUTH_ERROR_ACCOUNT_PENDING)).toBe('pending')
  })

  it('maps rejected account from hook message token', () => {
    expect(loginAuthErrorKind('UNAUTHORIZED', AUTH_ERROR_ACCOUNT_REJECTED)).toBe('rejected')
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
    pending: 'pending-msg',
    rejected: 'rejected-msg',
    generic: 'generic-msg',
  }

  it('returns the matching message', () => {
    expect(loginAuthErrorMessage('RATE_LIMITED', messages)).toBe('rate-msg')
    expect(loginAuthErrorMessage('INVALID_EMAIL_OR_PASSWORD', messages)).toBe('invalid-msg')
    expect(loginAuthErrorMessage('UNAUTHORIZED', messages, AUTH_ERROR_ACCOUNT_PENDING)).toBe(
      'pending-msg',
    )
    expect(loginAuthErrorMessage('UNAUTHORIZED', messages, AUTH_ERROR_ACCOUNT_REJECTED)).toBe(
      'rejected-msg',
    )
    expect(loginAuthErrorMessage('X', messages)).toBe('generic-msg')
  })
})
