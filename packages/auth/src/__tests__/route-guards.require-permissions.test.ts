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

import type { MRAuthClientForRouteRoles } from '../route-guards.js'
import { requirePermissions } from '../route-guards.js'

function createAuthStub(
  sessionPayload: {
    user?: { permissions?: unknown } | null
  } | null,
): MRAuthClientForRouteRoles {
  return {
    getSession: vi.fn().mockResolvedValue({ data: sessionPayload }),
    signOut: vi.fn().mockResolvedValue(undefined),
  }
}

describe('requirePermissions', () => {
  beforeEach(() => {
    redirectMock.mockClear()
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to login without session', async () => {
    const authClient = createAuthStub(null)

    await expect(requirePermissions(authClient, ['emotive_claims.view'])()).rejects.toThrow(
      'REDIRECT',
    )

    expect(redirectMock.mock.calls[0]?.[0]).toEqual({ to: '/login' })
  })

  it('redirects home when user lacks required permissions', async () => {
    const authClient = createAuthStub({
      user: { permissions: ['domace_claims.view'] },
    })

    await expect(
      requirePermissions(authClient, ['emotive_claims.view', 'emotive_claims.view_own_customer'])(),
    ).rejects.toThrow('REDIRECT')

    expect(redirectMock.mock.calls[0]?.[0]).toEqual({ to: '/' })
  })

  it('resolves when user has any required permission', async () => {
    const authClient = createAuthStub({
      user: { permissions: ['emotive_claims.view_own_customer'] },
    })

    await expect(
      requirePermissions(authClient, ['emotive_claims.view', 'emotive_claims.view_own_customer'])(),
    ).resolves.toBeUndefined()

    expect(redirectMock).not.toHaveBeenCalled()
  })
})
