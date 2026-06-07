export type LoginAuthErrorKind = 'invalid' | 'rate_limited' | 'generic'

export function loginAuthErrorKind(code: string | undefined): LoginAuthErrorKind {
  if (code === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'invalid'
  }
  if (code === 'RATE_LIMITED') {
    return 'rate_limited'
  }
  return 'generic'
}

export function loginAuthErrorMessage(
  code: string | undefined,
  messages: {
    invalid: string
    rateLimited: string
    generic: string
  },
): string {
  switch (loginAuthErrorKind(code)) {
    case 'invalid':
      return messages.invalid
    case 'rate_limited':
      return messages.rateLimited
    default:
      return messages.generic
  }
}
