import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  handleUnauthorizedSession,
  resetUnauthorizedSessionHandlerForTests,
} from '../unauthorized-session.js'

describe('handleUnauthorizedSession', () => {
  afterEach(() => {
    resetUnauthorizedSessionHandlerForTests()
    vi.unstubAllGlobals()
  })

  it('signs out and redirects to login once', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    const assign = vi.fn()

    vi.stubGlobal('window', { location: { assign } })

    handleUnauthorizedSession(signOut)
    handleUnauthorizedSession(signOut)

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
    })

    expect(assign).toHaveBeenCalledWith('/login')
  })
})
