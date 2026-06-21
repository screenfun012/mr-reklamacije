import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { InternalShell } from '~/components/layout/internal-shell'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/statistika')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: StatistikaComponent,
})

function StatistikaComponent() {
  return (
    <InternalShell>
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_statistika()}
        </Heading>
        <p className="text-muted-foreground">{m.placeholder_coming_soon_phase()}</p>
      </div>
    </InternalShell>
  )
}
