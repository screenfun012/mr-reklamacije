import { createFileRoute } from '@tanstack/react-router'

import { requireRoles } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'

import { InternalShell } from '~/components/layout/internal-shell'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/pristiglo')({
  beforeLoad: requireRoles(authClient, ['operator', 'admin']),
  component: PristigloComponent,
})

function PristigloComponent() {
  return (
    <InternalShell>
      <div>
        <h1 className="text-3xl font-bold mb-2">{m.nav_pristiglo()}</h1>
        <p className="text-muted-foreground">Coming soon — Phase 1</p>
      </div>
    </InternalShell>
  )
}
