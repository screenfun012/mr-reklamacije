import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'

import { AdminShell } from '~/components/layout/admin-shell'
import { adminRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/domace-claims')({
  beforeLoad: adminRequireRoles(['admin']),
  component: DomaceClaimsComponent,
})

function DomaceClaimsComponent() {
  return (
    <AdminShell>
      <div>
        <h1 className="text-3xl font-bold mb-2">{m.nav_domace_claims()}</h1>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </AdminShell>
  )
}
