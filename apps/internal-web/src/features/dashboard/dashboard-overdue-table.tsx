import { claimDetailPath, formatListDate, type DashboardOverdueItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { ClaimKindBadge, Heading, OutcomeBadge, Skeleton } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'

export interface DashboardOverdueTableProps {
  items: readonly DashboardOverdueItem[]
}

export function DashboardOverdueTable({ items }: DashboardOverdueTableProps) {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm font-medium text-foreground">{m.dashboard_overdue_empty()}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Heading level="h2">{m.dashboard_overdue_title()}</Heading>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.claims_col_kind()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_mr_number()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_partner()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_outcome()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_date_received()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.dashboard_overdue_col_days()}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const detailLink = claimDetailPath(item.kind, item.id)

              return (
                <tr
                  key={`${item.kind}-${item.id}`}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
                  onClick={() => {
                    void navigate(detailLink)
                  }}
                >
                  <td className="px-4 py-3">
                    <ClaimKindBadge kind={item.kind} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.mrNumber ?? '—'}</td>
                  <td className="px-4 py-3">{item.customerLabel ?? '—'}</td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={item.outcome} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.dateOfClaim ? formatListDate(item.dateOfClaim) : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {m.dashboard_overdue_days({ days: item.daysOpen })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const SKELETON_ROW_COUNT = 5

export function DashboardOverdueTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <div key={index} className="flex gap-4 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
