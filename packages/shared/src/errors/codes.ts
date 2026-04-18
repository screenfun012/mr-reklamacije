export const ERROR_CODE = {
  NotFound: 'NOT_FOUND',
  Forbidden: 'FORBIDDEN',
  Unauthorized: 'UNAUTHORIZED',
  ValidationError: 'VALIDATION_ERROR',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  InternalError: 'INTERNAL_ERROR',
  BadRequest: 'BAD_REQUEST',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]
