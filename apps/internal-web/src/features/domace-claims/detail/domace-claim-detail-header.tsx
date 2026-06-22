import {
  ClaimKind,
  ClaimOutcome,
  formatClaimDetailMetaLine,
  formatListDate,
  type ClaimOutcome as ClaimOutcomeType,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, ClaimKindBadge, Heading, OutcomeBadge } from '@mr/ui'
import { Pencil } from 'lucide-react'

import { DomaceClaimStatusActions } from './domace-claim-status-actions.js'

const EMPTY = '—'

export interface DomaceClaimDetailHeaderProps {
  claim: DomaceClaimDetail
  canEditBasic: boolean
  editingBasic: boolean
  canChangeOutcome: boolean
  canReopen: boolean
  onEditBasic: () => void
}

export function DomaceClaimDetailHeader({
  claim,
  canEditBasic,
  editingBasic,
  canChangeOutcome,
  canReopen,
  onEditBasic,
}: DomaceClaimDetailHeaderProps): React.ReactElement {
  const metaLine = formatClaimDetailMetaLine([
    claim.customerName,
    claim.engineTypeCode,
    claim.dateOfClaim ? formatListDate(claim.dateOfClaim) : null,
  ])

  const showEdit = canEditBasic && !editingBasic
  const isLocked = claim.outcome !== ClaimOutcome.Pending
  const showStatusActions = canChangeOutcome || (canReopen && isLocked)
  const showActionBar = showEdit || showStatusActions

  return (
    <header className="flex flex-col gap-3 border-b border-border pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level="h1" className="font-mono text-foreground">
          {claim.mrNumber ?? EMPTY}
        </Heading>
        <OutcomeBadge outcome={claim.outcome} />
        <ClaimKindBadge kind={ClaimKind.Domace} />
      </div>

      <p className="text-sm text-muted-foreground">{metaLine || EMPTY}</p>

      {showActionBar ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-3">
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
          {showStatusActions ? (
            <DomaceClaimStatusActions
              claimId={claim.id}
              currentOutcome={claim.outcome as ClaimOutcomeType}
              canChangeOutcome={canChangeOutcome}
              canReopen={canReopen}
              layout="inline"
            />
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
