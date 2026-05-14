import { createFileRoute } from '@tanstack/react-router'

import { requireRoles } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'

import { InternalShell } from '~/components/layout/internal-shell'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/')({
  beforeLoad: requireRoles(authClient, ['operator', 'admin']),
  component: HomeComponent,
})

function HomeComponent() {
  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  return (
    <InternalShell>
      <div>
        <h1 className="text-3xl font-bold mb-2">Dobrodošao, {userName}</h1>
        <p className="text-muted-foreground">{m.nav_pocetna()} — Coming soon — Phase 1</p>
      </div>
    </InternalShell>
  )
}
