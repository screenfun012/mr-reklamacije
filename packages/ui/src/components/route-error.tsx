import { m } from '@mr/i18n'

import { Heading } from './heading.js'
import { Button } from '../primitives/button.js'

/**
 * Branded fallback for a route whose loader/render threw.
 *
 * The retry arrives as a prop rather than the `reset` the router hands an `errorComponent`, because
 * `reset` does not retry: when a LOADER throws, the router leaves its match in `status: 'error'` and
 * `reset` clears only the catch boundary's own state — React re-renders, the match re-throws the same
 * error, and not one request goes out. Only `router.invalidate()` flips an errored match back to
 * pending and re-runs the loader. That call stays in the app because this package has no router
 * dependency, and adding one to reach `useRouter()` here would risk a second router instance whose
 * context the hook cannot see.
 */
export function RouteError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <Heading level="h1">{m.route_error_title()}</Heading>
      <p className="text-pretty text-sm text-muted-foreground">{m.route_error_description()}</p>
      <Button type="button" variant="outline" onClick={onRetry} className="mt-2">
        {m.route_error_retry()}
      </Button>
    </div>
  )
}
