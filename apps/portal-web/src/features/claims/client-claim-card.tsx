import { m, type Locale } from '@mr/i18n'
import { ClaimOutcome, type ClientClaimListItem } from '@mr/shared'
import { ArrowRight } from 'lucide-react'

import { useLocale } from '~/lib/locale'

import { ClientStatusBadge } from './client-status-badge'

function formatDate(value: string | null, locale: Locale): string {
  if (value === null) {
    return '—'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function engineName(claim: ClientClaimListItem): string {
  const parts = [claim.manufacturerName, claim.engineTypeCode].filter(
    (part): part is string => part !== null && part.length > 0,
  )
  return parts.length > 0 ? parts.join(' ') : (claim.mrNumber ?? '—')
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mr-text-tertiary">
        {label}
      </span>
      <span className="font-mono text-sm text-mr-text-body">{value}</span>
    </div>
  )
}

export interface ClientClaimCardProps {
  claim: ClientClaimListItem
}

// Archived claims are filtered out before render, so outcome is always visible.
type VisibleOutcome =
  | typeof ClaimOutcome.Pending
  | typeof ClaimOutcome.Accepted
  | typeof ClaimOutcome.Rejected

export function ClientClaimCard({ claim }: ClientClaimCardProps) {
  const { locale } = useLocale()
  const identifier = claim.mrNumber ?? claim.claimNumber ?? '—'

  return (
    <article className="flex flex-col gap-[18px] rounded-md border border-border bg-card p-[22px] shadow-sm transition-[transform,border-color,background-color] duration-150 hover:-translate-y-[3px] hover:border-primary/50 hover:bg-mr-surface-raised">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-mr-text-tertiary">{identifier}</span>
        <ClientStatusBadge outcome={claim.outcome as VisibleOutcome} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold leading-tight text-foreground">{engineName(claim)}</h3>
        {claim.customerName !== null ? (
          <p className="text-sm text-muted-foreground">{claim.customerName}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SpecCell label={m.portal_claims_model()} value={claim.engineTypeCode ?? '—'} />
        <SpecCell label={m.portal_claims_serial()} value={claim.engineCode ?? '—'} />
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between">
        <span className="text-xs text-mr-text-tertiary">
          {m.portal_claims_submitted()} {formatDate(claim.dateOfClaim, locale)}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          {m.portal_claims_view_details()}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  )
}
