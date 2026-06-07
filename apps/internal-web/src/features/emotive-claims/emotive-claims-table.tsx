import { formatListDate, type EmotiveClaimListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { OutcomeBadge, Skeleton } from '@mr/ui'

export interface EmotiveClaimsTableLookups {
  customerNameById: ReadonlyMap<string, string>
  engineCodeById: ReadonlyMap<string, string>
}

export interface EmotiveClaimsTableProps {
  items: readonly EmotiveClaimListItem[]
  lookups: EmotiveClaimsTableLookups
}

export function EmotiveClaimsTable({ items, lookups }: EmotiveClaimsTableProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm font-medium text-foreground">{m.emotive_claims_empty_title()}</p>
        <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_empty_description()}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">
              {m.emotive_claims_col_mr_number()}
            </th>
            <th className="px-4 py-3 font-medium text-muted-foreground">
              {m.emotive_claims_col_claim_number()}
            </th>
            <th className="px-4 py-3 font-medium text-muted-foreground">
              {m.emotive_claims_col_partner()}
            </th>
            <th className="px-4 py-3 font-medium text-muted-foreground">
              {m.emotive_claims_col_date()}
            </th>
            <th className="px-4 py-3 font-medium text-muted-foreground">
              {m.emotive_claims_col_outcome()}
            </th>
            <th className="px-4 py-3 font-medium text-muted-foreground">
              {m.emotive_claims_col_engine()}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((claim) => (
            <tr key={claim.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 font-mono text-xs">{claim.mrNumber}</td>
              <td className="px-4 py-3">{claim.claimNumber ?? '—'}</td>
              <td className="px-4 py-3">
                {claim.customerId ? (lookups.customerNameById.get(claim.customerId) ?? '—') : '—'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{formatListDate(claim.dateOfClaim)}</td>
              <td className="px-4 py-3">
                <OutcomeBadge outcome={claim.outcome} />
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {lookups.engineCodeById.get(claim.engineTypeId) ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SKELETON_ROW_COUNT = 8

export function EmotiveClaimsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border" aria-busy="true">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <div key={index} className="flex gap-4 px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
