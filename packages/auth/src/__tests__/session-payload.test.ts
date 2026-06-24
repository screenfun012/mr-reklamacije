/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import { resolveSessionPayload, toSerializableAuthSession } from '../session-payload.js'

describe('toSerializableAuthSession', () => {
  it('preserves name and email for router context', () => {
    const result = toSerializableAuthSession({
      user: {
        roles: ['admin'],
        permissions: ['claims.read'],
        name: 'Nikola Admin',
        email: 'nikola@example.com',
      },
    })

    expect(result).toEqual({
      user: {
        roles: ['admin'],
        permissions: ['claims.read'],
        name: 'Nikola Admin',
        email: 'nikola@example.com',
      },
    })
  })

  it('defaults missing name and email to empty strings', () => {
    const result = toSerializableAuthSession({
      user: { roles: ['operator'] },
    })

    expect(result).toEqual({
      user: { roles: ['operator'], permissions: [], name: '', email: '' },
    })
  })

  it('returns null when user is missing', () => {
    expect(toSerializableAuthSession(null)).toBeNull()
    expect(toSerializableAuthSession({ user: null })).toBeNull()
  })
})

describe('resolveSessionPayload', () => {
  it('normalizes Better-Auth client shape with display fields', () => {
    const payload = resolveSessionPayload({
      data: {
        user: {
          roles: ['admin'],
          name: 'Nikola Admin',
          email: 'nikola@example.com',
        },
      },
    })

    expect(toSerializableAuthSession(payload)).toEqual({
      user: {
        roles: ['admin'],
        permissions: [],
        name: 'Nikola Admin',
        email: 'nikola@example.com',
      },
    })
  })
})
