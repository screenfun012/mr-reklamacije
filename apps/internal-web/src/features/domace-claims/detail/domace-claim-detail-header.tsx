import {
  ClaimKind,
  formatClaimDetailMetaLine,
  formatListDate,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'

import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'
import { Pencil } from 'lucide-react'

import { CategoryChangeControl } from '../../claims/category-fields/category-change-control.js'
import { ClaimCategoryRetiredBadge } from '../../claims/category-fields/claim-category-retired-badge.js'

import { DomaceClaimStatusActions } from './domace-claim-status-actions.js'

const EMPTY = '—'

export interface DomaceClaimDetailHeaderProps {
  claim: DomaceClaimDetail
  canEditData: boolean
  editingData: boolean
  canChangeOutcome: boolean
  onEditData: () => void
}

export function DomaceClaimDetailHeader({
  claim,
  canEditData,
  editingData,
  canChangeOutcome,
  onEditData,
}: DomaceClaimDetailHeaderProps): React.ReactElement {
  // Same line as EMOTIVE (prototype §6): what it is, whose it is, when it came in, who has it.
  const metaLine = formatClaimDetailMetaLine([
    claim.claimNumber,
    claim.customerName,
    claim.dateOfClaim === null
      ? null
      : m.claim_detail_meta_received({ date: formatListDate(claim.dateOfClaim) }),
    claim.employeeName === null ? null : m.claim_detail_meta_worker({ worker: claim.employeeName }),
  ])

  const showEdit = canEditData && !editingData
  const showActionBar = showEdit || canChangeOutcome

  return (
    <header className="flex flex-col gap-3 border-b border-mri-border pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level="h1" className="font-mono text-mri-text">
          {claim.mrNumber ?? EMPTY}
        </Heading>
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

      <p className="text-sm text-mri-text2">{metaLine || EMPTY}</p>

      {showActionBar ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-mri-border pt-3">
          {showEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={onEditData}
            >
              <Pencil className="size-4" />
              {m.emotive_claims_detail_basic_edit()}
            </Button>
          ) : null}
          {canChangeOutcome ? (
            <DomaceClaimStatusActions
              claimId={claim.id}
              canChangeOutcome={canChangeOutcome}
              layout="inline"
            />
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
