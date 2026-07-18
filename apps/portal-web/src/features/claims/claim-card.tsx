import { m } from '@mr/i18n'
import { ClaimFreshness, ClientClaimPhase, type ClientClaimListItem } from '@mr/shared'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'

import { StatusChip } from '~/components/status-chip'
import { formatPortalClaimId, formatPortalDate } from '~/lib/portal-format'

import {
  claimServiceType,
  portalPhase,
  serviceTypeLabel,
  statusChipConfig,
  triBarConfig,
} from './claim-status-presentation'

function engineLine(claim: ClientClaimListItem): string {
  const parts = [claim.manufacturerName, claim.engineTypeCode].filter(
    (part): part is string => part !== null && part !== '',
  )
  return parts.join(' · ')
}

const CARD_CLASSES =
  'mrp-fade-up group relative block overflow-hidden rounded-[14px] border border-mrp-border bg-mrp-surface px-5 pb-[18px] pt-5 transition-[transform,box-shadow,border-color] duration-[220ms]'
const CARD_CLICKABLE_CLASSES =
  'hover:-translate-y-1 hover:border-[rgba(237,28,36,0.55)] hover:shadow-[var(--mrp-shadow)]'

/** Dashboard claim card: mono id + chip, service tag, engine, 3-segment progress. */
export function ClaimCard({ claim, index }: { claim: ClientClaimListItem; index: number }) {
  const chip = statusChipConfig(claim)
  const bar = triBarConfig(claim, 'var(--mrp-border)')
  // A Received claim's detail route 404s server-side (not yet client-visible)
  // — the card must not offer a link into it.
  const clickable = portalPhase(claim) !== ClientClaimPhase.Received
  const style = { animationDelay: `${(0.1 + index * 0.07).toFixed(2)}s` }

  const content = (
    <>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="font-mono text-[19px] font-bold tracking-[0.01em]">
          {formatPortalClaimId(claim.mrNumber, claim.claimNumber)}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {claim.freshness !== null && (
            <span className="inline-flex flex-none animate-pulse items-center whitespace-nowrap rounded-full bg-mrp-info-bg px-[9px] py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mrp-info motion-reduce:animate-none">
              {claim.freshness === ClaimFreshness.New
                ? m.portal_freshness_new()
                : m.portal_freshness_update()}
            </span>
          )}
          <StatusChip config={chip} />
        </div>
      </div>

      <span className="mb-3 inline-block rounded-[5px] border border-mrp-border2 px-[9px] py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-mrp-text2">
        {serviceTypeLabel(claimServiceType())}
      </span>

      <div className="mb-[3px] text-[14.5px] font-semibold">{engineLine(claim)}</div>
      <div className="text-[12.5px] text-mrp-text2">
        {m.portal_claims_received_label()}:{' '}
        <span className="font-mono text-xs font-semibold text-mrp-text">
          {formatPortalDate(claim.dateOfClaim)}
        </span>
      </div>

      <div className="mb-3.5 mt-4 flex gap-[5px]">
        <div className="h-[5px] flex-1 rounded-[3px]" style={{ background: bar.s1 }} />
        <div
          className={
            bar.s2Pulsing
              ? 'mrp-ring-warn h-[5px] flex-1 rounded-[3px]'
              : 'h-[5px] flex-1 rounded-[3px]'
          }
          style={{ background: bar.s2 }}
        />
        <div className="h-[5px] flex-1 rounded-[3px]" style={{ background: bar.s3 }} />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-mrp-text2">{claim.claimNumber ?? '—'}</span>
        {clickable && (
          <span className="text-[13.5px] font-bold text-mrp-redh">
            {m.portal_claims_details()} →
          </span>
        )}
      </div>
    </>
  )

  if (!clickable) {
    return (
      <div className={CARD_CLASSES} style={style}>
        {content}
      </div>
    )
  }

  return (
    <Link
      to="/claims/$id"
      params={{ id: claim.id }}
      className={cn(CARD_CLASSES, CARD_CLICKABLE_CLASSES)}
      style={style}
    >
      {content}
    </Link>
  )
}
