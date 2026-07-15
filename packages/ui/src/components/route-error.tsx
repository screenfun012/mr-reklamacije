import { m } from '@mr/i18n'

import { Heading } from './heading.js'
import { Button } from '../primitives/button.js'

/** Branded fallback for a route whose loader/render threw. `reset` retries the route. */
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <Heading level="h1">{m.route_error_title()}</Heading>
      <p className="text-sm text-muted-foreground">{m.route_error_description()}</p>
      <Button type="button" variant="outline" onClick={reset} className="mt-2">
        {m.route_error_retry()}
      </Button>
    </div>
  )
}
