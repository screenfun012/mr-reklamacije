import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

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
        <Heading level="h1" className="mb-2">
          {m.nav_domace_claims()}
        </Heading>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </AdminShell>
  )
}
