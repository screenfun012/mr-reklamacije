/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MRAuthClientForRouteRoles } from '../auth-client-types.js'
import { createRootAuthBeforeLoad, resolveAuthSessionForGuard } from '../router-auth.js'

function createAuthStub(sessionPayload: unknown): MRAuthClientForRouteRoles {
  return {
    getSession: vi.fn().mockResolvedValue({ data: sessionPayload }),
    signOut: vi.fn().mockResolvedValue(undefined),
  }
}

describe('createRootAuthBeforeLoad', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads session via getSession on the client', async () => {
    const authClient = createAuthStub({ user: { roles: ['operator'] } })
    const beforeLoad = createRootAuthBeforeLoad(authClient)

    const result = await beforeLoad()

    expect(authClient.getSession).toHaveBeenCalledTimes(1)
    expect(result.authSession).toEqual({
      user: { roles: ['operator'], permissions: [], name: '', email: '' },
    })
  })

  it('returns null session when getSession fails so login route still renders', async () => {
    const authClient: MRAuthClientForRouteRoles = {
      getSession: vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      signOut: vi.fn(),
    }
    const beforeLoad = createRootAuthBeforeLoad(authClient)

    await expect(beforeLoad()).resolves.toEqual({ authSession: null })
  })
})

describe('resolveAuthSessionForGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns router context session on the client without calling getSession', async () => {
    const authClient = createAuthStub(null)
    const session = { user: { roles: ['admin'], permissions: ['claims.read'] } }

    const result = await resolveAuthSessionForGuard(
      { context: { authSession: session } },
      authClient,
    )

    expect(result).toEqual({ user: { roles: ['admin'], permissions: ['claims.read'] } })
    expect(authClient.getSession).not.toHaveBeenCalled()
  })

  it('returns null on the client when router context has no session', async () => {
    const authClient = createAuthStub({ user: { roles: ['admin'] } })

    const result = await resolveAuthSessionForGuard({ context: {} }, authClient)

    expect(result).toBeNull()
    expect(authClient.getSession).not.toHaveBeenCalled()
  })
})
