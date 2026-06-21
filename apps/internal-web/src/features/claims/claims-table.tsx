import { ClaimKind, formatListDate, type ClaimListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { ClaimKindBadge, Heading, OutcomeBadge, Skeleton } from '@mr/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, Trash2 } from 'lucide-react'

export interface ClaimsTableProps {
  items: readonly ClaimListItem[]
  total: number
}

function claimCustomerName(item: ClaimListItem): string | null {
  return item.customerName
}

function claimEngineCode(item: ClaimListItem): string {
  return item.engineTypeCode ?? '—'
}

function claimDetailLink(item: ClaimListItem): {
  to: '/reklamacije/emotive/$id' | '/reklamacije/domace/$id'
  params: { id: string }
} {
  if (item.kind === ClaimKind.Domace) {
    return { to: '/reklamacije/domace/$id', params: { id: item.id } }
  }
  return { to: '/reklamacije/emotive/$id', params: { id: item.id } }
}

export function ClaimsTable({ items, total }: ClaimsTableProps) {
  const navigate = useNavigate()

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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <Heading level="h2">{m.emotive_claims_list_title()}</Heading>
        <span className="text-sm text-muted-foreground">
          {m.emotive_claims_count({ count: total })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.claims_col_kind()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_mr_number()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_claim_number()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_outcome()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_partner()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_engine()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_employee()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_date_finish()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_date_received()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.emotive_claims_col_actions()}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((claim) => {
              const detailLink = claimDetailLink(claim)

              return (
                <tr
                  key={`${claim.kind}-${claim.id}`}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
                  onClick={() => {
                    void navigate(detailLink)
                  }}
                >
                  <td className="px-4 py-3">
                    <ClaimKindBadge kind={claim.kind} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{claim.mrNumber ?? '—'}</td>
                  <td className="px-4 py-3">{claim.claimNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={claim.outcome} />
                  </td>
                  <td className="px-4 py-3">{claimCustomerName(claim) ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{claimEngineCode(claim)}</td>
                  <td className="px-4 py-3">{claim.employeeName ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {claim.dateOfFinish ? formatListDate(claim.dateOfFinish) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {claim.dateOfClaim ? formatListDate(claim.dateOfClaim) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={detailLink.to}
                        params={detailLink.params}
                        className="inline-flex size-8 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                        aria-label={m.emotive_claims_detail_view_action()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Eye className="size-4" />
                      </Link>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md text-destructive opacity-60"
                        disabled
                        aria-label="Obriši"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
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

const SKELETON_ROW_COUNT = 8

export function ClaimsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border" aria-busy="true">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <div key={index} className="flex gap-4 px-4 py-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
