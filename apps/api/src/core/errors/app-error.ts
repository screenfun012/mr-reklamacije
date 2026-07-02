import type { ErrorCode } from '@mr/shared'

/**
 * Thrown by route handlers / services to signal a known HTTP error.
 * Caught by app.onError() and mapped to standard JSON response.
 */
export class AppError extends Error {
  public override readonly name = 'AppError'

  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    // Carry the underlying error (`{ cause }`) so the global handler can log
    // the real failure while the client still gets the safe, generic message.
    options?: ErrorOptions,
  ) {
    super(message, options)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
