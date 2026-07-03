import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

export const Route = createFileRoute('/_shell/domace-claims')({
  component: DomaceClaimsComponent,
})

function DomaceClaimsComponent() {
  return (
    <div>
      <Heading level="h1" className="mb-2">
        {m.nav_domace_claims()}
      </Heading>
      <p className="text-muted-foreground">{m.placeholder_coming_soon_phase()}</p>
    </div>
  )
}
