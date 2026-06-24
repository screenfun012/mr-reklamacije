import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { dashboardSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'

import { InternalShell } from '~/components/layout/internal-shell'
import { DashboardContent } from '~/features/dashboard/dashboard-content'
import { DashboardOverdueTableSkeleton } from '~/features/dashboard/dashboard-overdue-table'
import { DashboardStatCardsSkeleton } from '~/features/dashboard/dashboard-stat-cards'
import { authClient } from '~/lib/auth-client'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(dashboardSummaryOptions()),
  component: HomeComponent,
  pendingComponent: HomePending,
  errorComponent: HomeError,
})

function HomeComponent() {
  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  return (
    <InternalShell>
      <div className="flex flex-col gap-6">
        <div>
          <Heading level="h1" className="mb-2">
            {m.dashboard_welcome({ userName })}
          </Heading>
          <p className="text-sm text-muted-foreground">{m.nav_pocetna()}</p>
        </div>
        <Suspense
          fallback={
            <>
              <DashboardStatCardsSkeleton />
              <DashboardOverdueTableSkeleton />
            </>
          }
        >
          <DashboardContent />
        </Suspense>
      </div>
    </InternalShell>
  )
}

function HomePending() {
  return (
    <InternalShell>
      <div className="flex flex-col gap-6">
        <div>
          <Heading level="h1">{m.nav_pocetna()}</Heading>
          <p className="mt-1 text-sm text-muted-foreground">{m.common_loading()}</p>
        </div>
        <DashboardStatCardsSkeleton />
        <DashboardOverdueTableSkeleton />
      </div>
    </InternalShell>
  )
}

function HomeError({ reset }: { reset: () => void }) {
  return (
    <InternalShell>
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">{m.emotive_claims_error_title()}</p>
        <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_error_description()}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={reset}>
          {m.emotive_claims_error_retry()}
        </Button>
      </div>
    </InternalShell>
  )
}
