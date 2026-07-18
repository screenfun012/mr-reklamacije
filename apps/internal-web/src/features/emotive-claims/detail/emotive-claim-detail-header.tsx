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

import { EmotiveClaimStatusActions } from './emotive-claim-status-actions.js'

const EMPTY = '—'

export interface EmotiveClaimDetailHeaderProps {
  claim: EmotiveClaimDetail
  canEditBasic: boolean
  editingBasic: boolean
  canChangeOutcome: boolean
  onEditBasic: () => void
}

export function EmotiveClaimDetailHeader({
  claim,
  canEditBasic,
  editingBasic,
  canChangeOutcome,
  onEditBasic,
}: EmotiveClaimDetailHeaderProps): React.ReactElement {
  const metaLine = formatClaimDetailMetaLine([
    claim.customerName,
    claim.engineTypeCode,
    formatListDate(claim.dateOfClaim),
  ])

  const showEdit = canEditBasic && !editingBasic
  const showActionBar = showEdit || canChangeOutcome

  return (
    <header className="flex flex-col gap-3 border-b border-mri-border pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level="h1" className="font-mono text-mri-text">
          {claim.mrNumber}
        </Heading>
        <OutcomePill outcome={claim.outcome} />
        <KindPill kind={ClaimKind.Emotive} />
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
              onClick={onEditBasic}
            >
              <Pencil className="size-4" />
              {m.emotive_claims_detail_basic_edit()}
            </Button>
          ) : null}
          {canChangeOutcome ? (
            <EmotiveClaimStatusActions
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
