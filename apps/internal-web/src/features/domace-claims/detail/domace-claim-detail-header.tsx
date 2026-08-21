import {
  ClaimKind,
  formatClaimDetailMetaLine,
  formatListDate,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Pencil } from 'lucide-react'

import { InternalButton } from '~/components/internal-button'
import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'

import { ClaimDetailBackLink } from '../../claims/claim-detail-back-link.js'
import { CategoryChangeControl } from '../../claims/category-fields/category-change-control.js'
import { ClaimCategoryRetiredBadge } from '../../claims/category-fields/claim-category-retired-badge.js'

import { DomaceClaimStatusActions } from './domace-claim-status-actions.js'

const EMPTY = '—'

export interface DomaceClaimDetailHeaderProps {
  claim: DomaceClaimDetail
  canEditData: boolean
  editingData: boolean
  canChangeOutcome: boolean
  /** The category list this claim was opened from, so "back" returns there. */
  categoryCode?: string | undefined
  onEditData: () => void
}

/** Same title block as EMOTIVE (handoff §1.2, spec §6) — DOMAĆA simply has nothing to publish. */
export function DomaceClaimDetailHeader({
  claim,
  canEditData,
  editingData,
  canChangeOutcome,
  categoryCode,
  onEditData,
}: DomaceClaimDetailHeaderProps): React.ReactElement {
  const metaLine = formatClaimDetailMetaLine([
    claim.claimNumber,
    claim.customerName,
    claim.dateOfClaim === null
      ? null
      : m.claim_detail_meta_received({ date: formatListDate(claim.dateOfClaim) }),
    claim.employeeName === null ? null : m.claim_detail_meta_worker({ worker: claim.employeeName }),
  ])

  const showEdit = canEditData && !editingData

  return (
    <header className="flex flex-col gap-[7px]">
      <ClaimDetailBackLink categoryCode={categoryCode} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-[11px]">
          <h1 className="font-mono text-[25px] font-bold tracking-[-0.01em] text-mri-text">
            {claim.mrNumber ?? EMPTY}
          </h1>
          <KindPill kind={ClaimKind.Domace} />
          <CategoryChangeControl
            kind={ClaimKind.Domace}
            claimId={claim.id}
            category={claim.category}
            canEdit={canEditData}
          />
          <ClaimCategoryRetiredBadge category={claim.category} />
          <OutcomePill outcome={claim.outcome} />
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-[9px]">
          {showEdit ? (
            <InternalButton
              type="button"
              variant="outline"
              className="h-[38px] w-auto px-4 text-[11.5px] tracking-[0.06em]"
              onClick={onEditData}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {m.emotive_claims_detail_basic_edit()}
            </InternalButton>
          ) : null}
          <DomaceClaimStatusActions claimId={claim.id} canChangeOutcome={canChangeOutcome} />
        </div>
      </div>

      <p className="text-[12.5px] text-mri-text2">{metaLine || EMPTY}</p>
    </header>
  )
}
