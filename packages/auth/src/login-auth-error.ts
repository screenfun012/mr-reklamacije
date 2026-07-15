import {
  AUTH_ERROR_ACCOUNT_LOCKED,
  AUTH_ERROR_ACCOUNT_PENDING,
  AUTH_ERROR_ACCOUNT_REJECTED,
} from './auth-error-codes.js'

export type LoginAuthErrorKind =
  | 'invalid'
  | 'rate_limited'
  | 'account_locked'
  | 'pending'
  | 'rejected'
  | 'generic'

function resolveAuthToken(code: string | undefined, message?: string): string | undefined {
  if (
    message === AUTH_ERROR_ACCOUNT_PENDING ||
    message === AUTH_ERROR_ACCOUNT_REJECTED ||
    message === AUTH_ERROR_ACCOUNT_LOCKED
  ) {
    return message
  }
  return code
}

export function loginAuthErrorKind(
  code: string | undefined,
  message?: string,
  status?: number,
): LoginAuthErrorKind {
  const token = resolveAuthToken(code, message)

  if (token === AUTH_ERROR_ACCOUNT_PENDING) {
    return 'pending'
  }
  if (token === AUTH_ERROR_ACCOUNT_REJECTED) {
    return 'rejected'
  }
  // Account lockout is HTTP 429 AND carries the ACCOUNT_LOCKED code — check it
  // BEFORE the status-based rate-limit branch so it isn't swallowed as generic.
  if (token === AUTH_ERROR_ACCOUNT_LOCKED) {
    return 'account_locked'
  }
  if (token === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'invalid'
  }
  // The built-in / backstop IP limiter returns a bare 429 with no code — detect
  // it by status so the friendly message shows instead of the generic one.
  if (token === 'RATE_LIMITED' || status === 429) {
    return 'rate_limited'
  }
  return 'generic'
}

export function loginAuthErrorMessage(
  code: string | undefined,
  messages: {
    invalid: string
    rateLimited: string
    accountLocked: string
    pending: string
    rejected: string
    generic: string
  },
  message?: string,
  status?: number,
): string {
  switch (loginAuthErrorKind(code, message, status)) {
    case 'invalid':
      return messages.invalid
    case 'rate_limited':
      return messages.rateLimited
    case 'account_locked':
      return messages.accountLocked
    case 'pending':
      return messages.pending
    case 'rejected':
      return messages.rejected
    default:
      return messages.generic
  }
}
