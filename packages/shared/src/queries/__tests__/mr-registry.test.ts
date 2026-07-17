import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/api-error.js'
import { ClaimKind } from '../../enums.js'
import { mrConflictFromError, mrRegistryKeys, mrRegistryLookupOptions } from '../mr-registry.js'

describe('mrRegistryLookupOptions', () => {
  it('keys the query on the normalized MR value', () => {
    const options = mrRegistryLookupOptions('mr 12345')
    expect(options.queryKey).toEqual(mrRegistryKeys.lookup('mr 12345'))
  })
})

describe('mrConflictFromError', () => {
  it('extracts the existing claim from a 409 ApiError with MR conflict details', () => {
    const error = new ApiError('MR broj je već dodeljen drugoj reklamaciji', 409, 'CONFLICT', {
      kind: ClaimKind.Emotive,
      claimId: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(mrConflictFromError(error)).toEqual({
      kind: ClaimKind.Emotive,
      claimId: '123e4567-e89b-12d3-a456-426614174000',
    })
  })

  it('returns null for non-409, missing details, or malformed details', () => {
    expect(mrConflictFromError(new Error('boom'))).toBeNull()
    expect(mrConflictFromError(new ApiError('Forbidden', 403, 'FORBIDDEN'))).toBeNull()
    expect(mrConflictFromError(new ApiError('Conflict', 409, 'CONFLICT'))).toBeNull()
    expect(
      mrConflictFromError(new ApiError('Conflict', 409, 'CONFLICT', { kind: 'weird' })),
    ).toBeNull()
  })
})
