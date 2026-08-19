import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement, ReactNode } from 'react'

/**
 * What the dot beside the label means. `warning` also tints the hint, because that tile is the one
 * that says somebody is blocked until an admin looks.
 */
export type StatCardTone = 'info' | 'success' | 'neutral' | 'warning'

const DOT_CLASSES: Record<StatCardTone, string> = {
  info: 'bg-adm-blu',
  success: 'bg-adm-grn',
  neutral: 'bg-adm-gry',
  warning: 'bg-adm-amb',
}

const BORDER_CLASSES: Record<StatCardTone, string> = {
  info: 'border-adm-blu/30',
  success: 'border-border',
  neutral: 'border-border',
  warning: 'border-adm-amb/35',
}

export interface StatCardProps {
  title: string
  value: number
  hint: string
  tone: StatCardTone
  /** Replaces the hint when there is a month-over-month figure to show. */
  trend?: ReactNode
  /** When set, the tile becomes a link to this route. */
  to?: string
}

/**
 * One figure, in the prototype's shape: a mono caps label with a coloured dot, the number at 27px
 * mono, and one line saying what it counts.
 *
 * The number is mono on purpose — four tiles side by side with proportional digits do not line up,
 * and the eye reads the row as four different sizes.
 */
export function StatCard({ title, value, hint, tone, trend, to }: StatCardProps): ReactElement {
  const body = (
    <>
      <span className="flex items-center gap-[7px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT_CLASSES[tone])} />
        {title}
      </span>
      <span className="mt-2 block font-mono text-[27px] font-bold tabular-nums text-foreground">
        {value}
      </span>
      <span
        className={cn(
          'mt-1 block text-[11.5px]',
          tone === 'warning' ? 'text-adm-amb' : 'text-muted-foreground',
        )}
      >
        {trend ?? hint}
      </span>
    </>
  )

  const className = cn(
    'block rounded-[13px] border bg-card px-[17px] py-[15px] text-left',
    BORDER_CLASSES[tone],
    to !== undefined && 'transition-colors hover:bg-mr-list-item-hover',
  )

  if (to === undefined) {
    return <div className={className}>{body}</div>
  }

  return (
    <Link to={to} className={className}>
      {body}
    </Link>
  )
}
