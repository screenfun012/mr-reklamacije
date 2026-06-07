import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'

import { InternalShell } from '~/components/layout/internal-shell'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: ReklamacijeComponent,
})

function ReklamacijeComponent() {
  return (
    <InternalShell>
      <div>
        <h1 className="text-3xl font-bold mb-2">{m.nav_reklamacije()}</h1>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </InternalShell>
  )
}
