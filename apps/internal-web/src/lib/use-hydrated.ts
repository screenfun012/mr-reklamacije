import { useSyncExternalStore } from 'react'

/** Nothing to subscribe to: the answer changes exactly once, when React hydrates. */
function subscribe(): () => void {
  return () => undefined
}

/**
 * `false` on the server and during the hydration render, `true` from the next render on.
 *
 * This exists for one shape of bug, and it is not cosmetic. `_shell.tsx` warms the sidebar's
 * counts with a fire-and-forget `void queryClient.prefetchQuery(...)` — deliberately, so a slow
 * or failed count can never take the menu down. The server therefore renders the sidebar BEFORE
 * that query resolves, the answer then arrives during streaming and is dehydrated into the page,
 * and the client hydrates with a cache the server never had: the HTML says `▾` where the client
 * says `18`. React does not patch that up — it discards the whole server tree and rebuilds it,
 * which on this app has looked like a screen redrawing without its buttons.
 *
 * Measured 2026-08-23 by loading `/razgovori` six times: two carried it. It is a RACE, so a
 * single clean load proves nothing — the fix has to remove the difference, not win the race.
 *
 * Gate anything whose value can arrive between the server render and hydration on this, so both
 * sides deterministically render the same thing and the value appears on the render after.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
