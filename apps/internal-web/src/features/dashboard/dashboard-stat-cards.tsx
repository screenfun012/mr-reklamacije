import {
  ClaimKind,
  ClaimOutcome,
  type ClaimsSearch,
  type DashboardStats,
  type DashboardTrends,
  type DashboardStatTrend,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle, cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'

import { DashboardStatTrendBadge } from './dashboard-stat-trend-badge'

export interface DashboardStatCardsProps {
  stats: DashboardStats
  trends: DashboardTrends
}

type StatAccent = 'neutral' | 'pending' | 'accepted' | 'rejected'

type StatCardLinkSearch = Pick<ClaimsSearch, 'outcome' | 'kind'>

interface StatCardConfig {
  title: string
  value: number
  accent: StatAccent
  linkSearch?: StatCardLinkSearch
  trend?: DashboardStatTrend
}

const CARD_ACCENT_CLASSES: Record<StatAccent, string> = {
  neutral: '',
  pending:
    'border-mr-warning/45 bg-mr-warning-subtle/40 dark:border-mr-warning/55 dark:bg-mr-warning/15',
  accepted:
    'border-mr-success/45 bg-mr-success-subtle/40 dark:border-mr-success/55 dark:bg-mr-success/15',
  rejected: 'border-mr-error/45 bg-mr-error-subtle/40 dark:border-mr-error/55 dark:bg-mr-error/15',
}

const VALUE_ACCENT_CLASSES: Record<StatAccent, string> = {
  neutral: 'text-foreground',
  pending: 'text-mr-warning-strong dark:text-mr-warning',
  accepted: 'text-mr-success-strong dark:text-mr-success',
  rejected: 'text-mr-error-strong dark:text-mr-error',
}

function buildCards(stats: DashboardStats, trends: DashboardTrends): StatCardConfig[] {
  return [
    { title: m.dashboard_card_total(), value: stats.total, accent: 'neutral' },
    {
      title: m.dashboard_card_pending(),
      value: stats.pending,
      accent: 'pending',
      linkSearch: { outcome: ClaimOutcome.Pending },
      trend: trends.pending,
    },
    {
      title: m.dashboard_card_accepted(),
      value: stats.accepted,
      accent: 'accepted',
      linkSearch: { outcome: ClaimOutcome.Accepted },
    },
    {
      title: m.dashboard_card_rejected(),
      value: stats.rejected,
      accent: 'rejected',
      linkSearch: { outcome: ClaimOutcome.Rejected },
    },
    {
      title: m.dashboard_card_this_month(),
      value: stats.newThisMonth,
      accent: 'neutral',
      trend: trends.newThisMonth,
    },
    {
      title: m.dashboard_card_emotive(),
      value: stats.byKind.emotive,
      accent: 'neutral',
      linkSearch: { kind: ClaimKind.Emotive },
    },
    {
      title: m.dashboard_card_domace(),
      value: stats.byKind.domace,
      accent: 'neutral',
      linkSearch: { kind: ClaimKind.Domace },
    },
  ]
}

function StatCard({ card }: { card: StatCardConfig }) {
  const cardBody = (
    <Card className={cn(CARD_ACCENT_CLASSES[card.accent], card.linkSearch && 'h-full')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div className={cn('text-3xl font-bold tabular-nums', VALUE_ACCENT_CLASSES[card.accent])}>
            {card.value}
          </div>
          {card.trend ? <DashboardStatTrendBadge trend={card.trend} /> : null}
        </div>
      </CardContent>
    </Card>
  )

  if (!card.linkSearch) {
    return cardBody
  }

  return (
    <Link
      to="/reklamacije"
      search={{ page: 1, pageSize: 10, ...card.linkSearch }}
      className="block cursor-pointer rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {cardBody}
    </Link>
  )
}

export function DashboardStatCards({ stats, trends }: DashboardStatCardsProps) {
  const cards = buildCards(stats, trends)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => (
        <StatCard key={card.title} card={card} />
      ))}
    </div>
  )
}

export function DashboardStatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: 7 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-9 w-16 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
