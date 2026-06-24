import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Suspense } from 'react'

import { STATISTICS_VIEW_PERMISSIONS, statisticsSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'

import { InternalShell } from '~/components/layout/internal-shell'
import { StatistikaAnalyticsSection } from '~/features/statistika/analytics/statistika-analytics-section'
import { StatisticsTrendChartsSkeleton } from '~/features/statistika/analytics/statistics-trend-charts-skeleton'
import { StatistikaExportSection } from '~/features/statistika/statistika-export-section'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/statistika')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  loader: ({ context: { queryClient, authSession } }) => {
    const permissions = authSession?.user?.permissions ?? []
    const canViewStatistics = STATISTICS_VIEW_PERMISSIONS.some((permission) =>
      permissions.includes(permission),
    )

    if (canViewStatistics) {
      return queryClient.ensureQueryData(statisticsSummaryOptions())
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
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const canViewStatistics = hasStatisticsPermission(permissions)
  const canExportPartial = permissions.includes('export.workbook_partial')
  const canExportFull = permissions.includes('export.workbook_full')

  return (
    <InternalShell>
      <div className="flex flex-col gap-8">
        <div>
          <Heading level="h1" className="mb-2">
            {m.nav_statistika()}
          </Heading>
          <p className="text-muted-foreground">{m.statistika_subtitle()}</p>
        </div>

        <Suspense fallback={<StatisticsTrendChartsSkeleton />}>
          <StatistikaAnalyticsSection canViewStatistics={canViewStatistics} />
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
    </InternalShell>
  )
}
