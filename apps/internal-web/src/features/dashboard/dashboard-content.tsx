import { dashboardSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { formatInternalDateEyebrow } from '~/lib/internal-format'
import { useLocale } from '@mr/ui'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'

import { DashboardClaimsChartSkeleton } from './dashboard-chart-skeleton'
import { DashboardClaimList } from './dashboard-claim-list'
import { DashboardStatCards } from './dashboard-stat-cards'

// Lazy-loaded so recharts stays out of the entry chunk (same pattern
// as statistika-analytics-section).
const LazyDashboardClaimsChart = lazy(() =>
  import('./dashboard-outcome-chart').then((module) => ({
    default: module.DashboardClaimsChart,
  })),
)

export function DashboardHeader({ subtitle }: { subtitle: string }) {
  const { userName } = useInternalAuthUser()
  const { locale } = useLocale()
  const firstName = userName.split(/\s+/)[0] ?? userName

  return (
    <div className="mri-fade-up mb-[30px]">
      <div className="mb-2.5 font-mono text-[11px] font-medium tracking-[0.2em] text-mri-redh">
        {formatInternalDateEyebrow(new Date(), locale)}
      </div>
      <h1 className="mb-2 text-[34px] font-extrabold tracking-[-0.02em] text-mri-text">
        {m.internal_dashboard_welcome({ userName: firstName })}
      </h1>
      <p className="text-[15px] text-mri-text2">{subtitle}</p>
    </div>
  )
}

export function DashboardContent() {
  const { data } = useSuspenseQuery(dashboardSummaryOptions())

  return (
    <>
      <DashboardHeader
        subtitle={m.dashboard_subtitle_live({
          pending: data.stats.pending,
          newThisMonth: data.stats.newThisMonth,
        })}
      />
      <div className="flex flex-col gap-[26px]">
        <DashboardStatCards stats={data.stats} trends={data.trends} />
        <div
          className="mri-fade-up grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start"
          style={{ animationDelay: '0.15s' }}
        >
          <DashboardClaimList
            title={m.dashboard_recent_title()}
            emptyMessage={m.dashboard_recent_empty()}
            items={data.recent}
            headerAction={
              <Link
                to="/reklamacije"
                search={{ page: 1, pageSize: 10 }}
                className="text-[12.5px] font-bold text-mri-redh hover:underline"
              >
                {m.dashboard_see_all()} →
              </Link>
            }
          />
          <DashboardClaimList
            title={m.dashboard_overdue_title()}
            emptyMessage={m.dashboard_overdue_empty()}
            items={data.overdue}
            daysUrgency
            headerAction={
              <span className="font-mono text-[11px] text-mri-text2">
                {m.dashboard_overdue_hint()}
              </span>
            }
          />
        </div>
        <div className="mri-fade-up" style={{ animationDelay: '0.28s' }}>
          <Suspense fallback={<DashboardClaimsChartSkeleton />}>
            <LazyDashboardClaimsChart data={data.chart} />
          </Suspense>
        </div>
      </div>
    </>
  )
}
