import type { ErrorCode } from '@mr/shared'

/**
 * Thrown by route handlers / services to signal a known HTTP error.
 * Caught by app.onError() and mapped to standard JSON response.
 */
export class AppError extends Error {
  public override readonly name = 'AppError' as const

  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
