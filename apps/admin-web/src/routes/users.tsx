import { createFileRoute } from '@tanstack/react-router'

import { adminRequireRoles } from '~/lib/auth-guard'
import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { AdminShell } from '~/components/layout/admin-shell'
export const Route = createFileRoute('/users')({
  beforeLoad: adminRequireRoles(['admin']),
  component: UsersComponent,
})

function UsersComponent() {
  return (
    <AdminShell>
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_users()}
        </Heading>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </AdminShell>
  )
}
