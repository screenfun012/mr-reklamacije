import {
  ClaimKind,
  formatClaimDetailMetaLine,
  formatListDate,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Pencil } from 'lucide-react'

import { InternalButton } from '~/components/internal-button'
import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'

import { ClaimDetailBackLink } from '../../claims/claim-detail-back-link.js'
import { CategoryChangeControl } from '../../claims/category-fields/category-change-control.js'
import { ClaimCategoryRetiredBadge } from '../../claims/category-fields/claim-category-retired-badge.js'

import { EmotiveClaimStatusActions } from './emotive-claim-status-actions.js'

const EMPTY = '—'

export interface EmotiveClaimDetailHeaderProps {
  claim: EmotiveClaimDetail
  canEditBasic: boolean
  editingBasic: boolean
  canChangeOutcome: boolean
  /** The category list this claim was opened from, so "back" returns there. */
  categoryCode?: string | undefined
  onEditBasic: () => void
}

/**
 * The claim's title block (handoff §1.2, spec §6): back link, then ONE row carrying what the
 * claim is on the left and every action on the right. There is no separate action bar — an
 * empty strip under the title with three buttons pushed into its right end is exactly what the
 * 21.08. handoff sent back.
 */
export function EmotiveClaimDetailHeader({
  claim,
  canEditBasic,
  editingBasic,
  canChangeOutcome,
  categoryCode,
  onEditBasic,
}: EmotiveClaimDetailHeaderProps): React.ReactElement {
  // The prototype's line, in its order and words: what it IS, whose it is, when it came in and
  // who has it (§6). The engine type is a column in the card below; it does not need repeating.
  const metaLine = formatClaimDetailMetaLine([
    claim.claimNumber,
    claim.customerName,
    m.claim_detail_meta_received({ date: formatListDate(claim.dateOfClaim) }),
    claim.employeeName === null ? null : m.claim_detail_meta_worker({ worker: claim.employeeName }),
  ])

  const showEdit = canEditBasic && !editingBasic

  return (
    <header className="flex flex-col gap-[7px]">
      <ClaimDetailBackLink categoryCode={categoryCode} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-[11px]">
          <h1 className="font-mono text-[25px] font-bold tracking-[-0.01em] text-mri-text">
            {claim.mrNumber}
          </h1>
          <KindPill kind={ClaimKind.Emotive} />
          <CategoryChangeControl
            kind={ClaimKind.Emotive}
            claimId={claim.id}
            category={claim.category}
            canEdit={canEditBasic}
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
              onClick={onEditBasic}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {m.emotive_claims_detail_basic_edit()}
            </InternalButton>
          ) : null}
          <EmotiveClaimStatusActions claimId={claim.id} canChangeOutcome={canChangeOutcome} />
        </div>
      </div>

      <p className="text-[12.5px] text-mri-text2">{metaLine || EMPTY}</p>
    </header>
  )
}
