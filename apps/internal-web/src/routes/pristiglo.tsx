import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { InternalShell } from '~/components/layout/internal-shell'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/pristiglo')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: PristigloComponent,
})

function PristigloComponent() {
  return (
    <InternalShell>
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_pristiglo()}
        </Heading>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </InternalShell>
  )
}
