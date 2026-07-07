import type { SerializableAuthSession } from './session-payload.js'

/**
 * Client-only bridge between the reactive Better-Auth session (React, via
 * AuthProvider) and the router's root `beforeLoad` (non-React). The root guard
 * reads the current session from here instead of calling `authClient.getSession()`
 * — an uncached network round-trip — on every navigation.
 *
 * ponytail: a module-level singleton is correct here — one browser tab tree has
 * exactly one user session. It is never read on the server (each SSR request
 * resolves its own session via loadServerSession), so there is no cross-request
 * bleed. `undefined` = not yet settled (guard falls back to a one-off fetch);
 * `null` = settled-and-signed-out.
 */
let clientSession: SerializableAuthSession | null | undefined

/** `undefined` resets to the unsettled state (guard falls back to a fetch). */
export function setClientSession(session: SerializableAuthSession | null | undefined): void {
  clientSession = session
}

export function getClientSession(): SerializableAuthSession | null | undefined {
  return clientSession
}
