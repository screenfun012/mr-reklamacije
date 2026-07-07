import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The redirect util is verified in unauthorized-session.test.ts; here we assert
// only that AuthProvider invokes it on the right transition (its unit boundary).
vi.mock('../unauthorized-session.js', () => ({
  handleUnauthorizedSession: vi.fn(),
  resetUnauthorizedSessionHandlerForTests: vi.fn(),
}))

import { AuthProvider } from '../auth-provider.js'
import { setClientSession } from '../client-session-store.js'
import { handleUnauthorizedSession } from '../unauthorized-session.js'

const handleMock = vi.mocked(handleUnauthorizedSession)

type Snapshot = {
  data: { user: Record<string, unknown> | null } | null
  isPending: boolean
  isRefetching?: boolean
  error: unknown
}

function makeClient(initial: Snapshot) {
  const useSession = vi.fn(() => initial)
  return {
    useSession,
    signOut: vi.fn().mockResolvedValue(undefined),
  } as unknown as Parameters<typeof AuthProvider>[0]['authClient'] & {
    useSession: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
  }
}

const AUTHED: Snapshot = {
  data: { user: { roles: ['admin'], permissions: [] } },
  isPending: false,
  isRefetching: false,
  error: null,
}
const SIGNED_OUT: Snapshot = { data: null, isPending: false, isRefetching: false, error: null }

afterEach(() => {
  handleMock.mockClear()
  setClientSession(undefined)
})

describe('AuthProvider revocation redirect', () => {
  it('kicks the tab to /login when the session goes signed-in → signed-out', () => {
    const authClient = makeClient(AUTHED)
    const { rerender } = render(
      <AuthProvider authClient={authClient}>
        <span />
      </AuthProvider>,
    )

    // Session revoked from another login (single-device) — now settled signed-out.
    authClient.useSession.mockReturnValue(SIGNED_OUT)
    rerender(
      <AuthProvider authClient={authClient}>
        <span />
      </AuthProvider>,
    )

    expect(handleMock).toHaveBeenCalledTimes(1)
  })

  it('does not redirect on an initial signed-out session (the /login page)', () => {
    const authClient = makeClient(SIGNED_OUT)
    render(
      <AuthProvider authClient={authClient}>
        <span />
      </AuthProvider>,
    )

    expect(handleMock).not.toHaveBeenCalled()
  })

  it('does not treat a background refetch as a logout (no false redirect)', () => {
    const authClient = makeClient(AUTHED)
    const { rerender } = render(
      <AuthProvider authClient={authClient}>
        <span />
      </AuthProvider>,
    )

    authClient.useSession.mockReturnValue({ ...AUTHED, isRefetching: true })
    rerender(
      <AuthProvider authClient={authClient}>
        <span />
      </AuthProvider>,
    )

    expect(handleMock).not.toHaveBeenCalled()
  })
})
