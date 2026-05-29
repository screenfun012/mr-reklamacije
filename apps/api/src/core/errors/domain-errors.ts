import { ERROR_CODE } from '@mr/shared'

import { AppError } from './app-error.js'

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

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ERROR_CODE.Conflict, 409, message)
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}
