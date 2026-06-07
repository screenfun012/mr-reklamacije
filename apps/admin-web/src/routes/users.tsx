import { createFileRoute } from '@tanstack/react-router'

import { adminRequireRoles } from '~/lib/auth-guard'
import { m } from '@mr/i18n'

import { AdminShell } from '~/components/layout/admin-shell'
export const Route = createFileRoute('/users')({
  beforeLoad: adminRequireRoles(['admin']),
  component: UsersComponent,
})

function UsersComponent() {
  return (
    <AdminShell>
      <div>
        <h1 className="text-3xl font-bold mb-2">{m.nav_users()}</h1>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </AdminShell>
  )
}
