import { AUTH_ERROR_ACCOUNT_PENDING, AUTH_ERROR_ACCOUNT_REJECTED } from './auth-error-codes.js'

export type LoginAuthErrorKind = 'invalid' | 'rate_limited' | 'pending' | 'rejected' | 'generic'

function resolveAuthToken(code: string | undefined, message?: string): string | undefined {
  if (message === AUTH_ERROR_ACCOUNT_PENDING || message === AUTH_ERROR_ACCOUNT_REJECTED) {
    return message
  }
  return code
}

export function loginAuthErrorKind(code: string | undefined, message?: string): LoginAuthErrorKind {
  const token = resolveAuthToken(code, message)

  if (token === AUTH_ERROR_ACCOUNT_PENDING) {
    return 'pending'
  }
  if (token === AUTH_ERROR_ACCOUNT_REJECTED) {
    return 'rejected'
  }
  if (token === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'invalid'
  }
  if (token === 'RATE_LIMITED') {
    return 'rate_limited'
  }
  return 'generic'
}

export function loginAuthErrorMessage(
  code: string | undefined,
  messages: {
    invalid: string
    rateLimited: string
    pending: string
    rejected: string
    generic: string
  },
  message?: string,
): string {
  switch (loginAuthErrorKind(code, message)) {
    case 'invalid':
      return messages.invalid
    case 'rate_limited':
      return messages.rateLimited
    case 'pending':
      return messages.pending
    case 'rejected':
      return messages.rejected
    default:
      return messages.generic
  }
}
