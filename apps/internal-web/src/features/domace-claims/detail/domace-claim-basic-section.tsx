import { formatListDate, type DomaceClaimDetail } from '@mr/shared'
import { m } from '@mr/i18n'

import { InternalCard } from '~/components/internal-card'

import { ClaimDetailItem } from '../../claims/claim-detail-item.js'

const EMPTY = '—'

export interface DomaceClaimBasicSectionProps {
  claim: DomaceClaimDetail
  /** The MR number is the page title — the grid does not repeat it. */
  hideMr?: boolean
}

/**
 * "Osnovni podaci" for a DOMAĆA claim, read-only (spec §6). Same four-column grid as EMOTIVE,
 * with the labels this kind's Excel actually uses (docs/23). Editing lives behind the title
 * row's "Izmeni podatke", in {@link DomaceClaimOverviewEdit}.
 */
export function DomaceClaimBasicSection({
  claim,
  hideMr = false,
}: DomaceClaimBasicSectionProps): React.ReactElement {
  return (
    <InternalCard title={m.domace_claims_create_section_basic()}>
      {/* Counted against the space this card actually HAS, not the window's: the sidebar and
          the 340px right column both eat into it, and `lg:` knows about neither. The container
          is NAMED so a descendant's own `@min-[…]` query cannot be captured by it. */}
      <div className="@container/basics">
        <dl className="grid gap-[15px_14px] @min-[360px]/basics:grid-cols-2 @min-[520px]/basics:grid-cols-3 @min-[700px]/basics:grid-cols-4">
          {hideMr ? null : (
            <ClaimDetailItem
              label={m.domace_claims_create_field_mr_number()}
              value={claim.mrNumber}
              mono
            />
          )}
          <ClaimDetailItem
            label={m.domace_claims_create_field_claim_number()}
            value={claim.claimNumber}
            mono
          />
          <ClaimDetailItem
            label={m.domace_claims_create_field_customer_name()}
            value={claim.customerName}
          />
          <ClaimDetailItem label={m.field_claim_category()} value={claim.category?.name ?? null} />
          <ClaimDetailItem
            label={m.emotive_claims_detail_field_manufacturer()}
            value={claim.manufacturerName ?? claim.engineTypeManufacturer}
          />
          <ClaimDetailItem
            label={m.domace_claims_create_field_engine_type()}
            value={claim.engineTypeCode}
            mono
          />
          <ClaimDetailItem label={m.claims_field_assigned_worker()} value={claim.employeeName} />
          <ClaimDetailItem
            label={m.domace_claims_create_field_date_claim()}
            value={claim.dateOfClaim ? formatListDate(claim.dateOfClaim) : null}
            mono
          />
          <ClaimDetailItem
            label={m.domace_claims_create_field_invoice_number()}
            value={claim.invoiceNumber}
            mono
          />
          <ClaimDetailItem
            label={m.domace_claims_create_field_engine_code()}
            value={claim.engineCode}
            mono
          />
          <ClaimDetailItem
            label={m.domace_claims_create_field_date_finish()}
            value={claim.dateOfFinish ? formatListDate(claim.dateOfFinish) : null}
            mono
          />
          <ClaimDetailItem
            label={m.domace_claims_detail_field_claim_year()}
            value={String(claim.claimYear)}
            mono
          />
        </dl>
      </div>

      <div className="mt-[15px] flex flex-col gap-1">
        <dt className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
          {m.domace_claims_create_field_warranty_report()}
        </dt>
        <dd className="whitespace-pre-wrap text-[13px] font-semibold text-mri-text">
          {claim.warrantyReport ?? EMPTY}
        </dd>
      </div>
    </InternalCard>
  )
}
