import { m } from '@mr/i18n'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { AdminShell } from '~/components/layout/admin-shell'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/users')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (session === null) {
      throw redirect({ to: '/login' })
    }
  },
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
