import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Heading } from '@mr/ui'

import { AdminShell } from '~/components/layout/admin-shell'
import { adminRequireRoles } from '~/lib/auth-guard'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/')({
  beforeLoad: adminRequireRoles(['admin']),
  component: HomeComponent,
})

function HomeComponent() {
  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <Heading level="h1" className="mb-2">
            {m.dashboard_welcome({ userName })}
          </Heading>
          <p className="text-muted-foreground">{m.nav_dashboard()}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>{m.dashboard_card_open_claims()}</CardTitle>
              <CardDescription>{m.dashboard_coming_soon()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-muted-foreground">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{m.dashboard_card_this_month()}</CardTitle>
              <CardDescription>{m.dashboard_coming_soon()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-muted-foreground">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{m.dashboard_card_active_users()}</CardTitle>
              <CardDescription>{m.dashboard_coming_soon()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-muted-foreground">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{m.dashboard_card_quick_access()}</CardTitle>
              <CardDescription>{m.dashboard_coming_soon()}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Phase 1</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  )
}
