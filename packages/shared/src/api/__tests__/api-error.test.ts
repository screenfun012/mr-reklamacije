import { describe, expect, it } from 'vitest'

import { ApiError, parseApiErrorBody } from '../api-error.js'

describe('ApiError', () => {
  it('stores status and optional code', () => {
    const error = new ApiError('Forbidden', 403, 'FORBIDDEN')
    expect(error.message).toBe('Forbidden')
    expect(error.status).toBe(403)
    expect(error.code).toBe('FORBIDDEN')
    expect(error.name).toBe('ApiError')
  })
})

describe('parseApiErrorBody', () => {
  it('returns default message for non-object bodies', () => {
    expect(parseApiErrorBody(null)).toEqual({ message: 'Request failed' })
    expect(parseApiErrorBody('oops')).toEqual({ message: 'Request failed' })
  })

  it('returns default message when envelope has no error field', () => {
    expect(parseApiErrorBody({})).toEqual({ message: 'Request failed' })
  })

  it('maps API error envelope fields', () => {
    expect(
      parseApiErrorBody({
        error: { code: 'NOT_FOUND', message: 'Entity missing' },
      }),
    ).toEqual({ message: 'Entity missing', code: 'NOT_FOUND' })
  })

  it('falls back when error message is missing', () => {
    expect(parseApiErrorBody({ error: { code: 'VALIDATION' } })).toEqual({
      message: 'Request failed',
      code: 'VALIDATION',
    })
  })
})
