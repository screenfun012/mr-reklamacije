import { ERROR_CODE } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { AppError } from '../core/errors/app-error.js'

describe('AppError', () => {
  it('has code, status, message', () => {
    const err = new AppError(ERROR_CODE.NotFound, 404, 'Customer not found')
    expect(err.code).toBe(ERROR_CODE.NotFound)
    expect(err.status).toBe(404)
    expect(err.message).toBe('Customer not found')
  })

  it('is instance of Error', () => {
    const err = new AppError(ERROR_CODE.NotFound, 404, 'test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
  })

  it('has name AppError', () => {
    const err = new AppError(ERROR_CODE.NotFound, 404, 'test')
    expect(err.name).toBe('AppError')
  })
})
