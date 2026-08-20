import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { Suspense, useCallback } from 'react'

import {
  claimCategoriesReferenceOptions,
  engineManufacturersReferenceOptions,
  INTERNAL_APP_ROLES,
  STATISTICS_VIEW_PERMISSIONS,
  StatisticsSearchSchema,
  statisticsSummaryOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { StatistikaAnalyticsSection } from '~/features/statistika/analytics/statistika-analytics-section'
import { StatisticsTrendChartsSkeleton } from '~/features/statistika/analytics/statistics-trend-charts-skeleton'
import { StatistikaExportSection } from '~/features/statistika/statistika-export-section'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/statistika')({
  beforeLoad: internalRequireRoles(INTERNAL_APP_ROLES),
  validateSearch: (search) => StatisticsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient, authSession }, deps: search }) => {
    const permissions = authSession?.user?.permissions ?? []
    const canViewStatistics = STATISTICS_VIEW_PERMISSIONS.some((permission) =>
      permissions.includes(permission),
    )

    if (canViewStatistics) {
      return Promise.all([
        queryClient.ensureQueryData(statisticsSummaryOptions(search)),
        queryClient.ensureQueryData(engineManufacturersReferenceOptions({ activeOnly: true })),
        queryClient.ensureQueryData(claimCategoriesReferenceOptions({ activeOnly: true })),
      ])
    }

    return null
  },
  component: StatistikaComponent,
})

const rootRoute = getRouteApi('__root__')

function hasStatisticsPermission(permissions: readonly string[]): boolean {
  return STATISTICS_VIEW_PERMISSIONS.some((permission) => permissions.includes(permission))
}

function StatistikaComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const canViewStatistics = hasStatisticsPermission(permissions)
  const canExportPartial = permissions.includes('export.workbook_partial')
  const canExportFull = permissions.includes('export.workbook_full')

  const handleSearchChange = useCallback(
    (next: typeof search) => {
      void navigate({
        search: next,
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_statistika()}
        </Heading>
        <p className="text-muted-foreground">{m.statistika_subtitle()}</p>
      </div>

      <Suspense fallback={<StatisticsTrendChartsSkeleton />}>
        <StatistikaAnalyticsSection
          canViewStatistics={canViewStatistics}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </Suspense>

      {canExportPartial || canExportFull ? (
        <StatistikaExportSection
          canExportPartial={canExportPartial}
          canExportFull={canExportFull}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{m.statistika_export_no_permission()}</p>
      )}
    </div>
  )
}
