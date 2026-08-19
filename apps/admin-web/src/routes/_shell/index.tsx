import {
  auditLogListOptions,
  dashboardSummaryOptions,
  UserAccountStatus,
  usersListOptions,
} from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { Suspense, type ReactElement } from 'react'

import { m } from '@mr/i18n'
import { Heading, Skeleton, cn } from '@mr/ui'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { NeedsYouCard } from '~/components/dashboard/needs-you-card'
import { RecentChangesCard } from '~/components/dashboard/recent-changes-card'
import { StatCard } from '~/components/dashboard/stat-card'
import { TopFaultsCard } from '~/components/dashboard/top-faults-card'
import { authClient } from '~/lib/auth-client'
import { countUsersByStatus } from '~/lib/dashboard-user-counts'

export const Route = createFileRoute('/_shell/')({
  loader: async ({ context: { queryClient } }) => {
    // All three in parallel. The audit list is new here — without it in the loader the two cards
    // below render, then the browser fetches their contents after hydration, which is a waterfall
    // behind a screen that has already drawn.
    await Promise.all([
      queryClient.ensureQueryData(dashboardSummaryOptions()),
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
    return (
      <span className="text-xs text-muted-foreground">{m.dashboard_trend_vs_last_month()}</span>
    )
  }

  const isUp = delta > 0
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-medium',
        isUp ? 'text-mr-success-strong' : 'text-mr-error-strong',
      )}
      title={m.dashboard_trend_vs_last_month()}
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta)}
    </span>
  )
}

function DashboardContent(): ReactElement {
  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  const { data: summary } = useSuspenseQuery(dashboardSummaryOptions())
  const { data: users } = useSuspenseQuery(usersListOptions())
  const { data: audit } = useSuspenseInfiniteQuery(auditLogListOptions({}))
  const { active, pendingApproval } = countUsersByStatus(users)

  const pendingUsers = users.filter((user) => user.accountStatus === UserAccountStatus.Pending)
  const recentChanges = audit.pages.flatMap((page) => page.items)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading level="h1" className="mb-2">
          {m.dashboard_welcome({ userName })}
        </Heading>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={m.dashboard_card_open_claims()}
          value={summary.stats.pending}
          hint={m.dashboard_card_open_claims_hint()}
        />
        <StatCard
          title={m.dashboard_card_this_month()}
          value={summary.stats.newThisMonth}
          hint={m.dashboard_card_this_month_hint()}
          trend={<MonthTrend delta={summary.trends.newThisMonth.delta} />}
        />
        <StatCard
          title={m.dashboard_card_active_users()}
          value={active}
          hint={m.dashboard_card_active_users_hint()}
        />
        <StatCard
          title={m.dashboard_card_pending_approvals()}
          value={pendingApproval}
          hint={m.dashboard_card_pending_approvals_hint()}
          to="/users"
        />
      </div>

      {/* What is waiting on the left, what the system has been doing on the right — the two
          questions an admin opens this screen with. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <NeedsYouCard pendingUsers={pendingUsers} />
        <RecentChangesCard items={recentChanges} />
      </div>

      <TopFaultsCard rows={summary.topFaultEmployees} />
    </div>
  )
}

function DashboardSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
