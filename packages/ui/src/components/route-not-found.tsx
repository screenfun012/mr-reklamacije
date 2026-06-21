import { m } from '@mr/i18n'

import { Heading } from './heading.js'

export function RouteNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <Heading level="h1">{m.route_not_found_title()}</Heading>
      <p className="text-sm text-muted-foreground">{m.route_not_found_description()}</p>
    </div>
  )
}
