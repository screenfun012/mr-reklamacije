import { formatListDate, type EmotiveClaimDetail } from '@mr/shared'
import { m } from '@mr/i18n'

import { InternalCard } from '~/components/internal-card'

import { ClaimDetailItem } from '../../claims/claim-detail-item.js'

const EMPTY = '—'

export interface EmotiveClaimBasicSectionProps {
  claim: EmotiveClaimDetail
  /** The MR number is the page title — the grid does not repeat it. */
  hideMr?: boolean
}

/**
 * "Osnovni podaci", read-only (spec §6): a four-column grid of mono labels over their values,
 * codes and dates in mono. Everything the claim IS, at a glance, with nothing to save.
 *
 * Editing lives in {@link EmotiveClaimDataEdit}, behind the title row's "Izmeni podatke" —
 * one form for the basics, the category's answers and the faults, and one save.
 */
export function EmotiveClaimBasicSection({
  claim,
  hideMr = false,
}: EmotiveClaimBasicSectionProps): React.ReactElement {
  return (
    <InternalCard title={m.emotive_claims_detail_section_basic()}>
      {/* Counted against the space this card actually HAS, not the window's: the sidebar and
          the 340px right column both eat into it, and `lg:` knows about neither. The container
          is NAMED so a descendant's own `@min-[…]` query cannot be captured by it. */}
      <div className="@container/basics">
        <dl className="grid gap-[15px_14px] @min-[360px]/basics:grid-cols-2 @min-[520px]/basics:grid-cols-3 @min-[700px]/basics:grid-cols-4">
          {hideMr ? null : (
            <ClaimDetailItem label={m.emotive_claims_col_mr_number()} value={claim.mrNumber} mono />
          )}
          <ClaimDetailItem
            label={m.emotive_claims_col_claim_number()}
            value={claim.claimNumber}
            mono
          />
          <ClaimDetailItem label={m.emotive_claims_col_partner()} value={claim.customerName} />
          <ClaimDetailItem label={m.field_claim_category()} value={claim.category?.name ?? null} />
          <ClaimDetailItem
            label={m.emotive_claims_detail_field_manufacturer()}
            value={claim.manufacturerName ?? claim.engineTypeManufacturer}
          />
          <ClaimDetailItem
            label={m.emotive_claims_col_engine()}
            value={claim.engineTypeCode}
            mono
          />
          <ClaimDetailItem label={m.emotive_claims_col_employee()} value={claim.employeeName} />
          <ClaimDetailItem
            label={m.emotive_claims_col_date_received()}
            value={formatListDate(claim.dateOfClaim)}
            mono
          />
          <ClaimDetailItem
            label={m.emotive_claims_detail_field_engine_code()}
            value={claim.engineCode}
            mono
          />
          <ClaimDetailItem
            label={m.emotive_claims_detail_field_source()}
            value={resolveSource(claim)}
          />
          <ClaimDetailItem
            label={m.emotive_claims_col_date_finish()}
            value={claim.dateOfFinish ? formatListDate(claim.dateOfFinish) : null}
            mono
          />
          <ClaimDetailItem
            label={m.emotive_claims_detail_field_claim_year()}
            value={String(claim.claimYear)}
            mono
          />
        </dl>
      </div>

      <div className="mt-[15px] flex flex-col gap-1">
        <dt className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
          {m.emotive_claims_create_field_warranty_report()}
        </dt>
        <dd className="whitespace-pre-wrap text-[13px] font-semibold text-mri-text">
          {claim.warrantyReport ?? EMPTY}
        </dd>
      </div>
    </InternalCard>
  )
}

function resolveSource(claim: EmotiveClaimDetail): string | null {
  if (claim.sourceName && claim.sourceCode) {
    return `${claim.sourceName} (${claim.sourceCode})`
  }
  return claim.sourceName ?? claim.sourceCode
}
