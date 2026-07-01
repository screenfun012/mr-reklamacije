import { m } from '@mr/i18n'
import { type ClientClaimListItem } from '@mr/shared'
import { Input } from '@mr/ui'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ClientClaimCard } from './client-claim-card'
import { ClientClaimsPagination } from './client-claims-pagination'

function matchesQuery(claim: ClientClaimListItem, query: string): boolean {
  const haystack = [
    claim.mrNumber,
    claim.claimNumber,
    claim.manufacturerName,
    claim.engineTypeCode,
    claim.engineCode,
    claim.customerName,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

function PageHead({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {m.portal_claims_eyebrow()}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {m.portal_claims_title()}
        </h1>
        <p className="text-sm text-muted-foreground">{m.portal_claims_subtitle()}</p>
      </div>
      <div className="relative w-full sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-text-tertiary"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={m.portal_claims_search_placeholder()}
          aria-label={m.portal_claims_search_placeholder()}
          className="h-11 pl-9 font-mono text-sm"
        />
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-6 py-16 text-center" role="status">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

const CLAIMS_PER_PAGE = 9

function ClaimsBody({
  claims,
  filtered,
  pageItems,
}: {
  claims: ClientClaimListItem[]
  filtered: ClientClaimListItem[]
  pageItems: ClientClaimListItem[]
}) {
  if (claims.length === 0) {
    return (
      <EmptyState
        title={m.portal_claims_empty_title()}
        description={m.portal_claims_empty_description()}
      />
    )
  }

  if (filtered.length === 0) {
    return (
      <EmptyState title={m.portal_claims_search_empty()} description={m.portal_claims_subtitle()} />
    )
  }

  return (
    <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(328px,1fr))]">
      {pageItems.map((claim) => (
        <ClientClaimCard key={claim.id} claim={claim} />
      ))}
    </div>
  )
}

export interface ClientClaimsListProps {
  claims: ClientClaimListItem[]
  /** True when the fetch hit its cap (≤50), so more claims may exist server-side. */
  capped?: boolean
}

export function ClientClaimsList({ claims, capped = false }: ClientClaimsListProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (query.trim().length === 0) {
      return claims
    }
    return claims.filter((claim) => matchesQuery(claim, query))
  }, [claims, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / CLAIMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * CLAIMS_PER_PAGE, safePage * CLAIMS_PER_PAGE),
    [filtered, safePage],
  )

  const handleQueryChange = (value: string): void => {
    setQuery(value)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHead query={query} onQueryChange={handleQueryChange} />
      <ClaimsBody claims={claims} filtered={filtered} pageItems={pageItems} />
      <ClientClaimsPagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      {capped && claims.length > 0 ? (
        <p className="text-center text-xs text-mr-text-tertiary">{m.portal_claims_capped()}</p>
      ) : null}
    </div>
  )
}
