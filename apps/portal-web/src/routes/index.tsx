import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mr/ui'

import { PortalShell } from '~/components/layout/portal-shell'
import { portalRequireRoles } from '~/lib/auth-guard'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/')({
  beforeLoad: portalRequireRoles(['client', 'admin']),
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
