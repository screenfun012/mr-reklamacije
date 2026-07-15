import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

import { dashboardSummaryOptions, INTERNAL_APP_ROLES } from '@mr/shared'
import { m } from '@mr/i18n'

import { InternalButton } from '~/components/internal-button'
import { DashboardClaimListSkeleton } from '~/features/dashboard/dashboard-claim-list'
import { DashboardClaimsChartSkeleton } from '~/features/dashboard/dashboard-chart-skeleton'
import { DashboardStatCardsSkeleton } from '~/features/dashboard/dashboard-stat-cards'
import { DashboardContent } from '~/features/dashboard/dashboard-content'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/')({
  beforeLoad: internalRequireRoles(INTERNAL_APP_ROLES),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(dashboardSummaryOptions()),
  component: HomeComponent,
  pendingComponent: DashboardSkeleton,
  errorComponent: HomeError,
})

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="mb-[30px]">
        <div className="mb-3 h-3 w-40 animate-pulse rounded bg-mri-inbg" />
        <div className="mb-2 h-9 w-72 animate-pulse rounded bg-mri-inbg" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-mri-inbg" />
      </div>
      <div className="flex flex-col gap-[26px]">
        <DashboardStatCardsSkeleton />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DashboardClaimListSkeleton />
          <DashboardClaimListSkeleton />
        </div>
        <DashboardClaimsChartSkeleton />
      </div>
    </div>
  )
}

function HomeComponent() {
  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

function HomeError({ reset }: { reset: () => void }) {
  return (
    <div
      className="mx-auto w-full max-w-[1280px] rounded-[14px] border border-[rgba(224,92,82,0.3)] bg-[rgba(224,92,82,0.06)] px-6 py-8 text-center"
      role="alert"
    >
      <p className="text-sm font-semibold text-mri-text">{m.emotive_claims_error_title()}</p>
      <p className="mt-1 text-sm text-mri-text2">{m.emotive_claims_error_description()}</p>
      <InternalButton
        type="button"
        variant="outline"
        className="mx-auto mt-5 h-[42px] w-auto px-6 text-[12.5px]"
        onClick={reset}
      >
        {m.emotive_claims_error_retry()}
      </InternalButton>
    </div>
  )
}
