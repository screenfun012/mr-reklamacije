import { m } from '@mr/i18n'
import { useRouter } from '@tanstack/react-router'
import type { ReactElement, ReactNode } from 'react'

import { InternalButton } from '~/components/internal-button'

const RETRY_CLASSES = 'mt-4 h-[46px] w-auto px-[18px] text-[13px]'

/**
 * The error box both Servis screens show when their loader could not fetch.
 *
 * It owns the retry rather than taking a callback, because the retry is the only part that can be
 * wrong and a prop-shaped one is untestable here (internal-web has no route-level tests, so nobody
 * could assert the route wired it). Retrying calls `router.invalidate()`, NOT the `reset` the
 * router hands to an `errorComponent`: when a LOADER throws, the router match itself is left in
 * `status: 'error'`, and `reset` clears only the catch boundary's own state — React re-renders, the
 * match re-throws the same error, and the same box comes back without a single request going out.
 * `invalidate()` is the one call that flips an errored match back to pending and re-runs the loader;
 * `ensureQueryData` then fetches for real, because the failed query holds no data. It also fixes the
 * second half: `reset` is `undefined` during SSR, so a button whose PRESENCE depended on it would
 * render on the client and not on the server — a hydration mismatch in exactly the flow this box is
 * for.
 *
 * ⚠ The same dead `reset` wiring ships in seven other places (both claim details, three lists, two
 * portal screens) plus `@mr/ui`'s `RouteError`, which is internal-web's `defaultErrorComponent`.
 * Reported, deliberately not touched here — that is its own change, not a rider on this one.
 */
export function IntakeErrorState({
  title,
  description,
  canRetry,
}: {
  title: ReactNode
  /** `null` when the box says everything in its title — a 404 needs no second sentence. */
  description: ReactNode
  canRetry: boolean
}): ReactElement {
  const router = useRouter()

  return (
    <div
      className="rounded-[12px] border border-mri-bad/40 bg-mri-bad-bg px-4 py-10 text-center"
      role="alert"
    >
      <p className="font-semibold text-mri-text">{title}</p>
      {description === null ? null : <p className="mt-1 text-mri-text2">{description}</p>}
      {canRetry ? (
        <InternalButton
          type="button"
          variant="outline"
          className={RETRY_CLASSES}
          onClick={() => {
            void router.invalidate()
          }}
        >
          {/* Reusing the router's own retry label rather than minting a fifth copy of the same
              two words — four already exist across features. */}
          {m.route_error_retry()}
        </InternalButton>
      ) : null}
    </div>
  )
}
