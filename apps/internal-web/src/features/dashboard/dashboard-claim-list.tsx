import { claimDetailPath, OUTCOME_BADGE_CLASSES, type DashboardListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { ClaimKindBadge, cn, Heading, Skeleton } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'

export interface DashboardClaimListProps {
  title: string
  emptyMessage: string
  items: readonly DashboardListItem[]
  /** Color days badge by overdue urgency (>30 error, 7–30 warning). */
  daysUrgency?: boolean
}

const DAYS_BADGE_SHELL_CLASSES =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums'

const OVERDUE_URGENCY_CRITICAL_DAYS = 30

function overdueDaysBadgeClasses(days: number): string {
  if (days > OVERDUE_URGENCY_CRITICAL_DAYS) {
    return OUTCOME_BADGE_CLASSES.rejected
  }

  return OUTCOME_BADGE_CLASSES.pending
}

export function DashboardDaysBadge({ days, urgency = false }: { days: number; urgency?: boolean }) {
  const accentClasses = urgency ? overdueDaysBadgeClasses(days) : OUTCOME_BADGE_CLASSES.pending

  return (
    <span className={cn(DAYS_BADGE_SHELL_CLASSES, accentClasses, 'shrink-0')}>
      {m.dashboard_overdue_days({ days })}
    </span>
  )
}

export function DashboardClaimList({
  title,
  emptyMessage,
  items,
  daysUrgency = false,
}: DashboardClaimListProps) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Heading level="h2">{title}</Heading>
      </div>
      {items.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-6 py-10 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {items.map((item) => {
            const detailLink = claimDetailPath(item.kind, item.id)

            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/30"
                  onClick={() => {
                    void navigate(detailLink)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-foreground">
                      {item.mrNumber ?? '—'}
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {item.customerLabel ?? '—'}
                    </span>
                  </span>
                  <ClaimKindBadge kind={item.kind} className="shrink-0" />
                  <DashboardDaysBadge days={item.daysOpen} urgency={daysUrgency} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function DashboardClaimListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
