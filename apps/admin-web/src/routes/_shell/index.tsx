import {
  auditLogListOptions,
  dashboardSummaryOptions,
  formatDateEyebrow,
  UserAccountStatus,
  usersListOptions,
} from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { Suspense, type ReactElement } from 'react'

import { m } from '@mr/i18n'
import { Skeleton, useLocale } from '@mr/ui'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { ClaimsTrendCard } from '~/components/dashboard/claims-trend-card'
import { OverdueClaimsCard, RecentClaimsCard } from '~/components/dashboard/claim-list-cards'
import { NeedsYouCard } from '~/components/dashboard/needs-you-card'
import { RecentChangesCard } from '~/components/dashboard/recent-changes-card'
import { StatCard } from '~/components/dashboard/stat-card'
import { TopFaultsCard } from '~/components/dashboard/top-faults-card'
import { countUsersByStatus } from '~/lib/dashboard-user-counts'
import { useAdminAuthUser } from '~/lib/use-admin-auth-user'

/**
 * Two years of buckets, where internal-web takes the server's default six. The card is half the
 * screen wide here; six bars in that space are slabs, not a trend.
 */
const CHART_MONTHS = 24

export const Route = createFileRoute('/_shell/')({
  loader: async ({ context: { queryClient } }) => {
    // All three in parallel. The audit list is new here — without it in the loader the two cards
    // below render, then the browser fetches their contents after hydration, which is a waterfall
    // behind a screen that has already drawn.
    await Promise.all([
      queryClient.ensureQueryData(dashboardSummaryOptions({ months: CHART_MONTHS })),
      queryClient.ensureQueryData(usersListOptions()),
      queryClient.ensureInfiniteQueryData(auditLogListOptions({})),
    ])
  },
  component: HomeRoute,
})

function HomeRoute(): ReactElement {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function MonthTrend({ delta }: { delta: number }): ReactElement {
  if (delta === 0) {
    return <span>{m.dashboard_trend_vs_last_month()}</span>
  }

  const isUp = delta > 0
  return (
    <span
      className={`flex items-center gap-1 tabular-nums ${isUp ? 'text-adm-grn' : 'text-adm-red-h'}`}
      title={m.dashboard_trend_vs_last_month()}
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta)} {m.dashboard_trend_vs_last_month()}
    </span>
  )
}

function DashboardContent(): ReactElement {
  const { locale } = useLocale()
  const { userName } = useAdminAuthUser()

  const { data: summary } = useSuspenseQuery(dashboardSummaryOptions({ months: CHART_MONTHS }))
  const { data: users } = useSuspenseQuery(usersListOptions())
  const { data: audit } = useSuspenseInfiniteQuery(auditLogListOptions({}))
  const { active, pendingApproval } = countUsersByStatus(users)

  const pendingUsers = users.filter((user) => user.accountStatus === UserAccountStatus.Pending)
  const recentChanges = audit.pages.flatMap((page) => page.items)

  return (
    <div className="adm-enter flex flex-col gap-4">
      <div>
        <div className="mb-[7px] font-mono text-[10.5px] font-semibold tracking-[0.2em] text-adm-red-h">
          {formatDateEyebrow(new Date(), locale)}
        </div>
        <h1 className="text-balance text-[26px] font-extrabold tracking-[-0.02em] text-foreground">
          {m.dashboard_welcome({ userName })}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={m.dashboard_card_open_claims()}
          value={summary.stats.pending}
          hint={m.dashboard_card_open_claims_hint()}
          tone="info"
        />
        <StatCard
          title={m.dashboard_card_this_month()}
          value={summary.stats.newThisMonth}
          hint={m.dashboard_card_this_month_hint()}
          tone="success"
          trend={<MonthTrend delta={summary.trends.newThisMonth.delta} />}
        />
        <StatCard
          title={m.dashboard_card_active_users()}
          value={active}
          hint={m.dashboard_card_active_users_hint()}
          tone="neutral"
        />
        <StatCard
          title={m.dashboard_card_pending_approvals()}
          value={pendingApproval}
          hint={m.dashboard_card_pending_approvals_hint()}
          tone="warning"
          to="/users"
        />
      </div>

      {/* What is waiting on the left, what the shop has been doing on the right — the two questions
          an admin opens this screen with, in that order. */}
      <div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-[340px_1fr]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <NeedsYouCard pendingUsers={pendingUsers} />
          <TopFaultsCard rows={summary.topFaultEmployees} />
        </div>
        <ClaimsTrendCard months={summary.chart} />
      </div>

      {/* auto-fit, not lg:grid-cols-3: `lg:` fires on a 1024 VIEWPORT, but the sidebar takes 236
          of it and three columns then leave each ledger row 199px — the actor name got 19px
          for 138px of text and read as empty (measured 2026-08-22). The row is the prototype's
          and is fine at the ~340px it was drawn for; what was wrong is being handed 199. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        <RecentChangesCard items={recentChanges} />
        <RecentClaimsCard items={summary.recent} />
        <OverdueClaimsCard items={summary.overdue} />
      </div>
    </div>
  )
}

function DashboardSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      {/* rounded-[13px] mirrors the cards these stand in for — a 6px ghost snaps at swap. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-[92px] w-full rounded-[13px]" />
        <Skeleton className="h-[92px] w-full rounded-[13px]" />
        <Skeleton className="h-[92px] w-full rounded-[13px]" />
        <Skeleton className="h-[92px] w-full rounded-[13px]" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[340px_1fr]">
        <Skeleton className="h-[300px] w-full rounded-[13px]" />
        <Skeleton className="h-[300px] w-full rounded-[13px]" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        <Skeleton className="h-[220px] w-full rounded-[13px]" />
        <Skeleton className="h-[220px] w-full rounded-[13px]" />
        <Skeleton className="h-[220px] w-full rounded-[13px]" />
      </div>
    </div>
  )
}
