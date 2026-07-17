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

  it('stores optional details', () => {
    const details = { kind: 'emotive', claimId: 'abc' }
    const error = new ApiError('Conflict', 409, 'CONFLICT', details)
    expect(error.details).toEqual(details)
    expect(new ApiError('Forbidden', 403).details).toBeUndefined()
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

  it('passes details through when present', () => {
    expect(
      parseApiErrorBody({
        error: {
          code: 'CONFLICT',
          message: 'MR broj je već dodeljen drugoj reklamaciji',
          details: { kind: 'domace', claimId: 'xyz' },
        },
      }),
    ).toEqual({
      message: 'MR broj je već dodeljen drugoj reklamaciji',
      code: 'CONFLICT',
      details: { kind: 'domace', claimId: 'xyz' },
    })
  })
})
