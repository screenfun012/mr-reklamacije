import { ApiError } from '@mr/shared'
import { notFound } from '@tanstack/react-router'

/**
 * Wrap a route loader's fetch so a 404 reaches the screen as a NOT-FOUND rather than as an error.
 *
 * Four detail routes each decided this in their `errorComponent` with
 * `error instanceof ApiError && error.status === 404`, and that check is dead on a hard load — the
 * only load that matters here, since a pasted link or a hand-typed id IS a hard load. Measured
 * 2026-08-08: a loader error crossing the SSR boundary arrives on the client as a plain `Error`
 * with **no own properties at all** (`keys: []`, `status: undefined`, `constructor: 'Error'`); only
 * `message` survives. So every one of those screens answered a missing order with "could not be
 * loaded" plus a *Pokušaj ponovo* button that can never succeed, while the same id reached through
 * a client-side navigation said "not found" correctly. Two different answers to one question.
 *
 * `notFound()` is the router's own signal and crosses SSR intact, so the route renders its
 * `notFoundComponent` in both directions. The `instanceof` check is reliable HERE because this runs
 * inside the loader, on whichever side threw, before anything is serialized.
 */
export async function ensureFound<T>(load: Promise<T>): Promise<T> {
  try {
    return await load
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw notFound()
    }
    throw error
  }
}
