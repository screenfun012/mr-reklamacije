import { ERROR_CODE, type ClaimKind } from '@mr/shared'

import { AppError } from './app-error.js'

export interface MrKeyConflictExistingClaim {
  kind: ClaimKind
  claimId: string
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(ERROR_CODE.NotFound, 404, `${entity} ${id} not found`)
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(ERROR_CODE.Forbidden, 403, message)
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(ERROR_CODE.ValidationError, 400, message)
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Zahtev se ne može obraditi') {
    super(ERROR_CODE.ValidationError, 422, message)
    Object.setPrototypeOf(this, UnprocessableEntityError.prototype)
  }
}

/**
 * `details` is optional and reaches the client in the envelope's `details` field, so a
 * conflict can name the row the caller has to go and look at — a bare 409 leaves them
 * guessing. Omit it and the envelope is byte-identical to before.
 */
export class ConflictError extends AppError {
  readonly details: Record<string, unknown> | undefined

  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_CODE.Conflict, 409, message)
    this.details = details
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}

export class MrKeyConflictError extends ConflictError {
  constructor(public readonly existingClaim: MrKeyConflictExistingClaim) {
    super('MR broj je već dodeljen drugoj reklamaciji')
    Object.setPrototypeOf(this, MrKeyConflictError.prototype)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(ERROR_CODE.Unauthorized, 401, message)
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super(ERROR_CODE.BadRequest, 413, message)
    Object.setPrototypeOf(this, PayloadTooLargeError.prototype)
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string) {
    super(ERROR_CODE.BadRequest, 415, message)
    Object.setPrototypeOf(this, UnsupportedMediaTypeError.prototype)
  }
}

export class InternalError extends AppError {
  constructor(message = 'Something went wrong') {
    super(ERROR_CODE.InternalError, 500, message)
    Object.setPrototypeOf(this, InternalError.prototype)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Servis trenutno nije dostupan', options?: ErrorOptions) {
    super(ERROR_CODE.ServiceUnavailable, 503, message, options)
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}
