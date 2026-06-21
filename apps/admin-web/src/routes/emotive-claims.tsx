import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { AdminShell } from '~/components/layout/admin-shell'
import { adminRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/emotive-claims')({
  beforeLoad: adminRequireRoles(['admin']),
  component: EmotiveClaimsComponent,
})

function EmotiveClaimsComponent() {
  return (
    <AdminShell>
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_emotive_claims()}
        </Heading>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </AdminShell>
  )
}
