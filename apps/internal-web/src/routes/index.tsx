import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { InternalShell } from '~/components/layout/internal-shell'
import { authClient } from '~/lib/auth-client'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: HomeComponent,
})

function HomeComponent() {
  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  return (
    <InternalShell>
      <div>
        <Heading level="h1" className="mb-2">
          {m.dashboard_welcome({ userName })}
        </Heading>
        <p className="text-muted-foreground">
          {m.nav_pocetna()} — {m.placeholder_coming_soon_phase()}
        </p>
      </div>
    </InternalShell>
  )
}
