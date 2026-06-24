import type { DashboardStats } from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@mr/ui'

export interface DashboardStatCardsProps {
  stats: DashboardStats
}

interface StatCardConfig {
  title: string
  value: number
}

function buildCards(stats: DashboardStats): StatCardConfig[] {
  return [
    { title: m.dashboard_card_total(), value: stats.total },
    { title: m.dashboard_card_pending(), value: stats.pending },
    { title: m.dashboard_card_accepted(), value: stats.accepted },
    { title: m.dashboard_card_rejected(), value: stats.rejected },
    { title: m.dashboard_card_this_month(), value: stats.newThisMonth },
    { title: m.dashboard_card_emotive(), value: stats.byKind.emotive },
    { title: m.dashboard_card_domace(), value: stats.byKind.domace },
  ]
}

export function DashboardStatCards({ stats }: DashboardStatCardsProps) {
  const cards = buildCards(stats)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{card.value}</div>
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
