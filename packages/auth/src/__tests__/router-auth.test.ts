/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MRAuthClientForRouteRoles } from '../auth-client-types.js'
import { setClientSession } from '../client-session-store.js'
import { createRootAuthBeforeLoad, resolveAuthSessionForGuard } from '../router-auth.js'

function createAuthStub(sessionPayload: unknown): MRAuthClientForRouteRoles {
  return {
    getSession: vi.fn().mockResolvedValue({ data: sessionPayload }),
    signOut: vi.fn().mockResolvedValue(undefined),
  }
}

function stubBrowserGlobals(): void {
  vi.stubGlobal('window', {})
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
}

describe('createRootAuthBeforeLoad', () => {
  beforeEach(() => {
    stubBrowserGlobals()
    setClientSession(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setClientSession(undefined)
  })

  it('loads session via getSession on the client', async () => {
    const authClient = createAuthStub({ user: { roles: ['operator'] } })
    const beforeLoad = createRootAuthBeforeLoad(authClient)

    const result = await beforeLoad()

    expect(authClient.getSession).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      authSession: {
        user: { id: '', roles: ['operator'], permissions: [], name: '', email: '' },
      },
      locale: 'sr',
    })
  })

  it('returns null session when getSession fails so login route still renders', async () => {
    const authClient: MRAuthClientForRouteRoles = {
      getSession: vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      signOut: vi.fn(),
    }
    const beforeLoad = createRootAuthBeforeLoad(authClient)

    await expect(beforeLoad()).resolves.toEqual({ authSession: null, locale: 'sr' })
  })

  it('reads the AuthProvider-bridged session without a network fetch (kills the flood)', async () => {
    const authClient = createAuthStub({ user: { roles: ['operator'] } })
    setClientSession({
      user: { roles: ['admin'], permissions: ['claims.read'], name: 'A', email: 'a@x' },
    })
    const beforeLoad = createRootAuthBeforeLoad(authClient)

    const result = await beforeLoad()

    // Served from the bridged cache — no /get-session round-trip on navigation.
    expect(authClient.getSession).not.toHaveBeenCalled()
    expect(result).toEqual({
      authSession: {
        user: { roles: ['admin'], permissions: ['claims.read'], name: 'A', email: 'a@x' },
      },
      locale: 'sr',
    })
  })

  it('treats a settled signed-out session (null) as logged out without fetching', async () => {
    const authClient = createAuthStub({ user: { roles: ['operator'] } })
    setClientSession(null)
    const beforeLoad = createRootAuthBeforeLoad(authClient)

    const result = await beforeLoad()

    expect(authClient.getSession).not.toHaveBeenCalled()
    expect(result).toEqual({ authSession: null, locale: 'sr' })
  })
})

describe('resolveAuthSessionForGuard', () => {
  beforeEach(() => {
    stubBrowserGlobals()
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
