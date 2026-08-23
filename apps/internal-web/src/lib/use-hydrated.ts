import { useSyncExternalStore } from 'react'

/** Nothing to subscribe to: the answer changes exactly once, when React hydrates. */
function subscribe(): () => void {
  return () => undefined
}

/**
 * `false` on the server and during the hydration render, `true` from the next render on.
 *
 * This exists for one shape of bug, and it is not cosmetic. A value that arrives BETWEEN the
 * server's render and the browser's hydration — a query warmed with a fire-and-forget
 * `void queryClient.prefetchQuery(...)`, resolved during streaming and dehydrated into the page —
 * leaves the client hydrating with a cache the server never had: the HTML says `▾` where the
 * client says `18`. React does not patch that up. It discards the whole server tree and rebuilds
 * it, which on this app has looked like a screen redrawing without its buttons.
 *
 * Measured 2026-08-23 by loading `/razgovori` six times: two carried it. It is a RACE, so a
 * single clean load proves nothing — the fix has to remove the difference, not win the race.
 *
 * ⚠ It is the SECOND-best fix, and 2026-08-24 showed why. The claims counts used it, and holding
 * them back made the server render a deliberately SHORTER menu: the React error was gone and
 * 128px of menu still appeared after first paint, on every load. The gate hides a difference; it
 * cannot remove one. Where the server CAN have the value — await the query, read the cookie — do
 * that instead, and this hook is not needed at all. Reach for it only when the value genuinely
 * cannot exist until the browser does.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
