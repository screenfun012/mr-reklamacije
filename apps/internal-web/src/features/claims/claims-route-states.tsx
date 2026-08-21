import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { useRouter } from '@tanstack/react-router'

import { ClaimsTableSkeleton } from './claims-table'

/** Shared by the list of everything and by one category's list — the same wait, the same failure. */
export function ClaimsRoutePending(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <ClaimsTableSkeleton />
    </div>
  )
}

export function ClaimsRouteError(): React.ReactElement {
  // Not the `reset` the router offers an errorComponent: it clears the catch boundary, the errored
  // match re-throws, and no request goes out. `invalidate()` is what re-runs the loader.
  const router = useRouter()

  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
      role="alert"
    >
      <p className="text-sm font-medium text-foreground">{m.emotive_claims_error_title()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_error_description()}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => {
          void router.invalidate()
        }}
      >
        {m.emotive_claims_error_retry()}
      </Button>
    </div>
  )
}
