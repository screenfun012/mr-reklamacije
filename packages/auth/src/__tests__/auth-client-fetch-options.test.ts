import { beforeEach, describe, expect, it } from 'vitest'

import { authClientFetchOptions } from '../client.js'
import { getClientSession, setClientSession } from '../client-session-store.js'

function fireSuccess(url: string): void {
  authClientFetchOptions.onSuccess({ request: { url } })
}

/**
 * Regression for the "login needs two clicks" bug: after a sign-in / 2FA-verify
 * response, the shared client-session cache must be invalidated so the root
 * `beforeLoad` refetches the freshly-cookied session instead of reading the
 * stale settled-signed-out value and bouncing back to /login.
 */
describe('authClientFetchOptions.onSuccess', () => {
  beforeEach(() => {
    setClientSession(null)
  })

  it('invalidates the session cache after email sign-in', () => {
    fireSuccess('https://interno.mrengines.rs/api/auth/sign-in/email')
    expect(getClientSession()).toBeUndefined()
  })

  it('invalidates the session cache after two-factor verify', () => {
    fireSuccess('https://interno.mrengines.rs/api/auth/two-factor/verify-totp')
    expect(getClientSession()).toBeUndefined()
  })

  it('leaves the cache untouched for non-session-establishing responses', () => {
    fireSuccess('https://interno.mrengines.rs/api/auth/get-session')
    expect(getClientSession()).toBeNull()
  })
})
