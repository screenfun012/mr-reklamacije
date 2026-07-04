import { claimDetailPath, type DashboardListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { InternalCard, InternalCardHeader } from '~/components/internal-card'
import { InternalPill } from '~/components/internal-pill'
import { KindPill } from '~/components/kind-pill'

export interface DashboardClaimListProps {
  title: string
  emptyMessage: string
  items: readonly DashboardListItem[]
  /** Right-side header slot ("Sve →" link / "30+ dana" hint). */
  headerAction?: ReactNode
  /** Show days as an urgency pill (>30 red, else amber) instead of muted text. */
  daysUrgency?: boolean
  className?: string
}

const OVERDUE_URGENCY_CRITICAL_DAYS = 30

function DaysCell({ days, urgency }: { days: number; urgency: boolean }) {
  if (!urgency) {
    return (
      <span className="w-[64px] flex-none text-right font-mono text-[10.5px] tabular-nums text-mri-text2">
        {m.dashboard_overdue_days({ days })}
      </span>
    )
  }
  const critical = days > OVERDUE_URGENCY_CRITICAL_DAYS
  return (
    <InternalPill
      tone={critical ? 'bad' : 'warn'}
      className="text-[10.5px] normal-case tracking-normal tabular-nums"
    >
      {m.dashboard_overdue_days({ days })}
    </InternalPill>
  )
}

export function DashboardClaimList({
  title,
  emptyMessage,
  items,
  headerAction,
  daysUrgency = false,
  className,
}: DashboardClaimListProps) {
  const navigate = useNavigate()

  return (
    <InternalCard className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <InternalCardHeader title={title} action={headerAction} />
      {items.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-6 py-10 text-center"
          role="status"
        >
          <p className="text-sm italic text-mri-text2">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="max-h-[28rem] overflow-y-auto">
          {items.map((item) => {
            const detailLink = claimDetailPath(item.kind, item.id)

            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-mri-border px-5 py-[11px] text-left transition-colors duration-150 hover:bg-mri-rowhv"
                  onClick={() => {
                    void navigate(detailLink)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] font-semibold text-mri-text">
                      {item.mrNumber ?? '—'}
                    </span>
                    <span className="block truncate text-[12.5px] text-mri-text2">
                      {item.customerLabel ?? '—'}
                    </span>
                  </span>
                  <KindPill kind={item.kind} />
                  <DaysCell days={item.daysOpen} urgency={daysUrgency} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </InternalCard>
  )
}

export function DashboardClaimListSkeleton() {
  return (
    <InternalCard className="overflow-hidden">
      <div className="border-b border-mri-border px-5 py-4">
        <div className="h-5 w-40 animate-pulse rounded bg-mri-inbg" />
      </div>
      <div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-mri-border px-5 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-24 animate-pulse rounded bg-mri-inbg" />
              <div className="h-3.5 w-32 animate-pulse rounded bg-mri-inbg" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-mri-inbg" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-mri-inbg" />
          </div>
        ))}
      </div>
    </InternalCard>
  )
}
