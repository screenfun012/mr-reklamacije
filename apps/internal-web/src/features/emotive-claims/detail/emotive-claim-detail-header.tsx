import {
  ClaimKind,
  formatClaimDetailMetaLine,
  formatListDate,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'

import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'
import { Pencil } from 'lucide-react'

import { CategoryChangeControl } from '../../claims/category-fields/category-change-control.js'
import { ClaimCategoryRetiredBadge } from '../../claims/category-fields/claim-category-retired-badge.js'

import { EmotiveClaimStatusActions } from './emotive-claim-status-actions.js'

const EMPTY = '—'

export interface EmotiveClaimDetailHeaderProps {
  claim: EmotiveClaimDetail
  canEditBasic: boolean
  editingBasic: boolean
  canChangeOutcome: boolean
  /** Holder of emotive_claims.publish (operator + admin). */
  canPublish: boolean
  onEditBasic: () => void
}

export function EmotiveClaimDetailHeader({
  claim,
  canEditBasic,
  editingBasic,
  canChangeOutcome,
  canPublish,
  onEditBasic,
}: EmotiveClaimDetailHeaderProps): React.ReactElement {
  const metaLine = formatClaimDetailMetaLine([
    claim.customerName,
    claim.engineTypeCode,
    formatListDate(claim.dateOfClaim),
  ])

  const showEdit = canEditBasic && !editingBasic

  return (
    <header className="flex flex-col gap-3 border-b border-mri-border pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level="h1" className="font-mono text-mri-text">
          {claim.mrNumber}
        </Heading>
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

      <p className="text-sm text-mri-text2">{metaLine || EMPTY}</p>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-mri-border pt-3">
        {showEdit ? (
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onEditBasic}>
            <Pencil className="size-4" />
            {m.emotive_claims_detail_basic_edit()}
          </Button>
        ) : null}
        <EmotiveClaimStatusActions
          claimId={claim.id}
          outcome={claim.outcome}
          clientVisibleAt={claim.clientVisibleAt}
          publishedAt={claim.publishedAt}
          canChangeOutcome={canChangeOutcome}
          canPublish={canPublish}
          layout="inline"
        />
      </div>
    </header>
  )
}
