import { ERROR_CODE } from '@mr/shared'

/** Thrown when a server-side helper requires an authenticated session. */
export class UnauthorizedError extends Error {
  public override readonly name = 'UnauthorizedError'

  readonly code = ERROR_CODE.Unauthorized
  readonly status = 401

  constructor(message = 'Authentication required') {
    super(message)
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}
