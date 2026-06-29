import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement, ReactNode } from 'react'

export interface StatCardProps {
  title: string
  value: number
  hint: string
  trend?: ReactNode
  /** When set, the card becomes a link to this route. */
  to?: string
}

export function StatCard({ title, value, hint, trend, to }: StatCardProps): ReactElement {
  const card = (
    <Card
      className={cn(
        'h-full',
        to !== undefined &&
          'transition-colors hover:border-mr-info/50 hover:bg-muted/30 focus-visible:border-mr-info/50',
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div className="text-4xl font-bold tabular-nums">{value}</div>
          {trend}
        </div>
      </CardContent>
    </Card>
  )

  if (to === undefined) {
    return card
  }

  return (
    <Link to={to} className="block rounded-xl outline-none">
      {card}
    </Link>
  )
}
