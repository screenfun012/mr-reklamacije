import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { dashboardSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'

import { DashboardClaimListSkeleton } from '~/features/dashboard/dashboard-claim-list'
import { DashboardClaimsChartSkeleton } from '~/features/dashboard/dashboard-chart-skeleton'
import { DashboardContent } from '~/features/dashboard/dashboard-content'
import { DashboardStatCardsSkeleton } from '~/features/dashboard/dashboard-stat-cards'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(dashboardSummaryOptions()),
  component: HomeComponent,
  pendingComponent: HomePending,
  errorComponent: HomeError,
})

function DashboardSkeleton() {
  return (
    <>
      <DashboardStatCardsSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardClaimListSkeleton />
        <DashboardClaimListSkeleton />
      </div>
      <DashboardClaimsChartSkeleton />
    </>
  )
}

function HomeComponent() {
  const { userName } = useInternalAuthUser()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading level="h1" className="mb-2">
          {m.dashboard_welcome({ userName })}
        </Heading>
        <p className="text-sm text-muted-foreground">{m.nav_pocetna()}</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

function HomePending() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading level="h1">{m.nav_pocetna()}</Heading>
        <p className="mt-1 text-sm text-muted-foreground">{m.common_loading()}</p>
      </div>
      <DashboardSkeleton />
    </div>
  )
}

function HomeError({ reset }: { reset: () => void }) {
  return (
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
  )
}
