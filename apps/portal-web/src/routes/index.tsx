import { m } from '@mr/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mr/ui'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { PortalShell } from '~/components/layout/portal-shell'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    // TODO(phase-1.0): Add role check — require 'client' role
    // See docs/12-roadmap.md Phase 1.0 — Permissions
  },
  component: HomeComponent,
})

function HomeComponent() {
  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  return (
    <PortalShell>
      <Card className="mx-auto w-full max-w-lg text-center shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{m.dashboard_welcome({ userName })}</CardTitle>
          <CardDescription className="text-base">{m.portal_dashboard_subtitle()}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{m.dashboard_coming_soon()}</p>
        </CardContent>
      </Card>
    </PortalShell>
  )
}
