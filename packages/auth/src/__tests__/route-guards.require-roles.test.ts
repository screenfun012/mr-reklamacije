/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() =>
  vi.fn((opts: unknown) => {
    const err = new Error('REDIRECT')
    Object.assign(err, { redirectOpts: opts })
    throw err
  }),
)

vi.mock('@tanstack/react-router', () => ({
  redirect: (opts: unknown) => redirectMock(opts),
}))

import type { MRAuthClientForRouteRoles } from '../auth-client-types.js'
import { LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE } from '../auth-client-types.js'
import { requireRoles } from '../protected-routes.js'

function createAuthStub(
  overrides: Partial<MRAuthClientForRouteRoles> & {
    sessionPayload?: { user?: { roles?: unknown } | null } | null
  },
): MRAuthClientForRouteRoles {
  const getSession =
    overrides.getSession ?? vi.fn().mockResolvedValue({ data: overrides.sessionPayload ?? null })
  const signOut = overrides.signOut ?? vi.fn().mockResolvedValue(undefined)
  return { getSession, signOut }
}

describe('requireRoles', () => {
  beforeEach(() => {
    redirectMock.mockClear()
    redirectMock.mockImplementation((opts: unknown) => {
      const err = new Error('REDIRECT')
      Object.assign(err, { redirectOpts: opts })
      throw err
    })
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('redirects to login when router context has no session on the client', async () => {
    const authClient = createAuthStub({})

    await expect(requireRoles(authClient, ['admin'])({ context: {} })).rejects.toThrow('REDIRECT')

    expect(authClient.getSession).not.toHaveBeenCalled()
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(redirectMock.mock.calls[0]?.[0]).toEqual({ to: '/login' })
  })

  it('redirects to login when authSession has no user', async () => {
    const authClient = createAuthStub({})

    await expect(
      requireRoles(authClient, ['operator'])({ context: { authSession: {} } }),
    ).rejects.toThrow('REDIRECT')

    expect(authClient.getSession).not.toHaveBeenCalled()
    expect(redirectMock.mock.calls[0]?.[0]).toEqual({ to: '/login' })
  })

  it('resolves when user has one of the allowed roles from router context', async () => {
    const authClient = createAuthStub({})

    await expect(
      requireRoles(authClient, ['admin', 'operator'])({
        context: { authSession: { user: { roles: ['admin'] } } },
      }),
    ).resolves.toBeUndefined()

    expect(authClient.getSession).not.toHaveBeenCalled()
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('resolves when user has multiple roles and one matches', async () => {
    const authClient = createAuthStub({})

    await expect(
      requireRoles(authClient, ['operator', 'admin'])({
        context: { authSession: { user: { roles: ['viewer', 'operator'] } } },
      }),
    ).resolves.toBeUndefined()

    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('signs out and redirects with insufficient-role when user lacks allowed roles', async () => {
    const authClient = createAuthStub({})

    await expect(
      requireRoles(authClient, ['admin'])({
        context: { authSession: { user: { roles: ['client'] } } },
      }),
    ).rejects.toThrow('REDIRECT')

    expect(authClient.signOut).toHaveBeenCalledTimes(1)
    expect(redirectMock.mock.calls[0]?.[0]).toEqual({
      to: '/login',
      search: { reason: LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE },
    })
  })

  it('treats missing or invalid roles array as empty for authorization', async () => {
    const authClient = createAuthStub({})

    await expect(
      requireRoles(authClient, ['admin'])({
        context: { authSession: { user: { roles: 'not-an-array' } } },
      }),
    ).rejects.toThrow('REDIRECT')

    expect(authClient.signOut).toHaveBeenCalled()
    expect(redirectMock.mock.calls[0]?.[0]).toMatchObject({
      to: '/login',
      search: { reason: LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE },
    })
  })

  describe('during SSR', () => {
    beforeEach(() => {
      vi.unstubAllGlobals()
    })

    it('redirects to login when no server session loader is provided', async () => {
      const authClient = createAuthStub({})

      await expect(requireRoles(authClient, ['admin'])({ context: {} })).rejects.toThrow('REDIRECT')

      expect(authClient.getSession).not.toHaveBeenCalled()
      expect(redirectMock.mock.calls[0]?.[0]).toEqual({ to: '/login' })
    })

    it('redirects to login when server loader returns no user', async () => {
      const authClient = createAuthStub({})
      const loadServerSession = vi.fn().mockResolvedValue(null)

      await expect(
        requireRoles(authClient, ['admin'], loadServerSession)({ context: {} }),
      ).rejects.toThrow('REDIRECT')

      expect(loadServerSession).toHaveBeenCalledTimes(1)
      expect(authClient.getSession).not.toHaveBeenCalled()
      expect(redirectMock.mock.calls[0]?.[0]).toEqual({ to: '/login' })
    })

    it('resolves when server loader returns a user with an allowed role', async () => {
      const authClient = createAuthStub({})
      const loadServerSession = vi.fn().mockResolvedValue({
        user: { roles: ['operator'] },
      })

      await expect(
        requireRoles(authClient, ['operator', 'admin'], loadServerSession)({ context: {} }),
      ).resolves.toBeUndefined()

      expect(loadServerSession).toHaveBeenCalledTimes(1)
      expect(authClient.signOut).not.toHaveBeenCalled()
      expect(redirectMock).not.toHaveBeenCalled()
    })

    it('redirects with insufficient-role without calling signOut on the server', async () => {
      const authClient = createAuthStub({})
      const loadServerSession = vi.fn().mockResolvedValue({
        user: { roles: ['client'] },
      })

      await expect(
        requireRoles(authClient, ['admin'], loadServerSession)({ context: {} }),
      ).rejects.toThrow('REDIRECT')

      expect(authClient.signOut).not.toHaveBeenCalled()
      expect(redirectMock.mock.calls[0]?.[0]).toEqual({
        to: '/login',
        search: { reason: LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE },
      })
    })

    it('uses authSession from context without calling server loader', async () => {
      const authClient = createAuthStub({})
      const loadServerSession = vi.fn().mockResolvedValue(null)

      await expect(
        requireRoles(
          authClient,
          ['admin'],
          loadServerSession,
        )({
          context: { authSession: { user: { roles: ['admin'] } } },
        }),
      ).resolves.toBeUndefined()

      expect(loadServerSession).not.toHaveBeenCalled()
    })
  })
})
