import { createFileRoute } from '@tanstack/react-router'

import { requireRoles } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'

import { AdminShell } from '~/components/layout/admin-shell'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/domace-claims')({
  beforeLoad: requireRoles(authClient, ['admin']),
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
