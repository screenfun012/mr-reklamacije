import {
  ClaimKind,
  ClaimOutcome,
  type ClaimsSearch,
  type DashboardStats,
  type DashboardTrends,
  type DashboardStatTrend,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'

import { InternalCard } from '~/components/internal-card'

import { DashboardStatTrendBadge } from './dashboard-stat-trend-badge'

export interface DashboardStatCardsProps {
  stats: DashboardStats
  trends: DashboardTrends
}

type StatAccent = 'neutral' | 'pending' | 'accepted' | 'rejected' | 'month' | 'emotive' | 'domace'

type StatCardLinkSearch = Pick<ClaimsSearch, 'outcome' | 'kind'>

interface StatCardConfig {
  title: string
  value: number
  accent: StatAccent
  linkSearch?: StatCardLinkSearch
  trend?: DashboardStatTrend
  /** Rising count is BAD for this card (pending) — flips the trend colors. */
  trendInverted?: boolean
}

/** Design accents: status cards get a tinted border; every card gets a dot. */
const ACCENT_STYLES: Record<StatAccent, { border: string; dot: string; value: string }> = {
  neutral: { border: 'border-mri-border', dot: 'bg-mri-text2', value: 'text-mri-text' },
  pending: {
    border: 'border-[rgba(245,166,35,0.35)]',
    dot: 'bg-mri-warn',
    value: 'text-mri-warn',
  },
  accepted: {
    border: 'border-[rgba(31,169,113,0.3)]',
    dot: 'bg-mri-ok',
    value: 'text-mri-ok',
  },
  rejected: {
    border: 'border-[rgba(224,92,82,0.3)]',
    dot: 'bg-mri-bad',
    value: 'text-mri-bad',
  },
  month: { border: 'border-mri-border', dot: 'bg-mri-info', value: 'text-mri-text' },
  emotive: { border: 'border-mri-border', dot: 'bg-mri-info', value: 'text-mri-text' },
  domace: { border: 'border-mri-border', dot: 'bg-mri-domace', value: 'text-mri-text' },
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
      trendInverted: true,
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
      accent: 'month',
      trend: trends.newThisMonth,
    },
    {
      title: m.dashboard_card_emotive(),
      value: stats.byKind.emotive,
      accent: 'emotive',
      linkSearch: { kind: ClaimKind.Emotive },
    },
    {
      title: m.dashboard_card_domace(),
      value: stats.byKind.domace,
      accent: 'domace',
      linkSearch: { kind: ClaimKind.Domace },
    },
  ]
}

function StatCard({ card, index }: { card: StatCardConfig; index: number }) {
  const accent = ACCENT_STYLES[card.accent]
  const cardBody = (
    <InternalCard
      className={cn('mri-fade-up h-full rounded-xl px-[18px] py-4', accent.border)}
      style={{ animationDelay: `${(0.06 + index * 0.05).toFixed(2)}s` }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="whitespace-nowrap font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
          {card.title}
        </span>
        <span aria-hidden="true" className={cn('size-[7px] flex-none rounded-full', accent.dot)} />
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn('font-mono text-[27px] font-bold leading-none tabular-nums', accent.value)}
        >
          {card.value}
        </span>
        {card.trend ? (
          <DashboardStatTrendBadge trend={card.trend} inverted={card.trendInverted === true} />
        ) : null}
      </div>
    </InternalCard>
  )

  if (!card.linkSearch) {
    return cardBody
  }

  return (
    <Link
      to="/reklamacije"
      search={{ page: 1, pageSize: 10, ...card.linkSearch }}
      className="block cursor-pointer rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mri-red"
    >
      {cardBody}
    </Link>
  )
}

export function DashboardStatCards({ stats, trends }: DashboardStatCardsProps) {
  const cards = buildCards(stats, trends)

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
      {cards.map((card, index) => (
        <StatCard key={card.title} card={card} index={index} />
      ))}
    </div>
  )
}

export function DashboardStatCardsSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
      {Array.from({ length: 7 }, (_, index) => (
        <InternalCard key={index} className="rounded-xl px-[18px] py-4">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-mri-inbg" />
          <div className="h-7 w-14 animate-pulse rounded bg-mri-inbg" />
        </InternalCard>
      ))}
    </div>
  )
}
