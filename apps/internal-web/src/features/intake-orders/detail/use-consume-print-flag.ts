import { useEffect } from 'react'

/**
 * The wizard hands a freshly signed order over with `?stampa` set, because printing it is the next
 * thing that has to happen and the receiving worker should not have to find a button for it
 * (`docs/25` §3.0). This consumes that flag: it opens the preview, then clears the flag out of the
 * address.
 *
 * Both halves matter, and neither is obvious from reading the route:
 * - **open**, or the whole point of the flag is lost and the worker is left on a screen with tabs;
 * - **clear**, or every reload — and every Back into this screen — opens the preview again over an
 *   order that was handed over an hour ago.
 *
 * It lives in its own function so those two rules can be broken by a test. They were verified only
 * in a browser at first, and a mutation run on 2026-08-11 proved that deleting either one left the
 * whole suite green.
 */
export function useConsumePrintFlag({
  stampa,
  onOpen,
  onClear,
}: {
  stampa: boolean | undefined
  onOpen: () => void
  onClear: () => void
}): void {
  useEffect(() => {
    if (stampa !== true) {
      return
    }
    onOpen()
    onClear()
    // `stampa` is the ONLY dependency on purpose: the callbacks are new objects on every render of
    // the route, so depending on them would fire this again on the next one — and the second firing
    // would reopen the preview the worker had just closed.
  }, [stampa])
}
