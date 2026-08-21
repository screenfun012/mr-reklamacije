/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import { resolveSessionPayload, toSerializableAuthSession } from '../session-payload.js'

describe('toSerializableAuthSession', () => {
  it('preserves id, name and email for router context', () => {
    const result = toSerializableAuthSession({
      user: {
        id: 'user-1',
        roles: ['admin'],
        permissions: ['claims.read'],
        name: 'Nikola Admin',
        email: 'nikola@example.com',
      },
    })

    expect(result).toEqual({
      user: {
        // The id travels with the rest so "is this me?" is answered from the session the SERVER
        // rendered with — reading it from the live client session split SSR from hydration.
        id: 'user-1',
        roles: ['admin'],
        permissions: ['claims.read'],
        name: 'Nikola Admin',
        email: 'nikola@example.com',
      },
    })
  })

  it('defaults a missing id, name and email to empty strings', () => {
    const result = toSerializableAuthSession({
      user: { roles: ['operator'] },
    })

    expect(result).toEqual({
      user: { id: '', roles: ['operator'], permissions: [], name: '', email: '' },
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
        id: '',
        roles: ['admin'],
        permissions: [],
        name: 'Nikola Admin',
        email: 'nikola@example.com',
      },
    })
  })
})
