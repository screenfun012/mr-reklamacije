import type { DashboardStats } from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle, cn } from '@mr/ui'

export interface DashboardStatCardsProps {
  stats: DashboardStats
}

type StatAccent = 'neutral' | 'pending' | 'accepted' | 'rejected'

interface StatCardConfig {
  title: string
  value: number
  accent: StatAccent
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

function buildCards(stats: DashboardStats): StatCardConfig[] {
  return [
    { title: m.dashboard_card_total(), value: stats.total, accent: 'neutral' },
    { title: m.dashboard_card_pending(), value: stats.pending, accent: 'pending' },
    { title: m.dashboard_card_accepted(), value: stats.accepted, accent: 'accepted' },
    { title: m.dashboard_card_rejected(), value: stats.rejected, accent: 'rejected' },
    { title: m.dashboard_card_this_month(), value: stats.newThisMonth, accent: 'neutral' },
    { title: m.dashboard_card_emotive(), value: stats.byKind.emotive, accent: 'neutral' },
    { title: m.dashboard_card_domace(), value: stats.byKind.domace, accent: 'neutral' },
  ]
}

export function DashboardStatCards({ stats }: DashboardStatCardsProps) {
  const cards = buildCards(stats)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.title} className={cn(CARD_ACCENT_CLASSES[card.accent])}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn('text-3xl font-bold tabular-nums', VALUE_ACCENT_CLASSES[card.accent])}
            >
              {card.value}
            </div>
          </CardContent>
        </Card>
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
