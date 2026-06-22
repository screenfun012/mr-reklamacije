import {
  ClaimKind,
  formatListDate,
  type ClaimOutcome as ClaimOutcomeType,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, ClaimKindBadge, Heading, OutcomeBadge } from '@mr/ui'
import { Pencil } from 'lucide-react'

import { EmotiveClaimStatusActions } from './emotive-claim-status-actions.js'

const EMPTY = '—'

export interface EmotiveClaimDetailHeaderProps {
  claim: EmotiveClaimDetail
  canEditBasic: boolean
  editingBasic: boolean
  canChangeOutcome: boolean
  canReopen: boolean
  onEditBasic: () => void
}

function formatHeaderMeta(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .filter((part): part is string => part !== null && part !== undefined && part.trim() !== '')
    .join(' · ')
}

export function EmotiveClaimDetailHeader({
  claim,
  canEditBasic,
  editingBasic,
  canChangeOutcome,
  canReopen,
  onEditBasic,
}: EmotiveClaimDetailHeaderProps): React.ReactElement {
  const metaLine = formatHeaderMeta([
    claim.customerName,
    claim.engineTypeCode,
    formatListDate(claim.dateOfClaim),
  ])

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h1" className="font-mono text-foreground">
              {claim.mrNumber}
            </Heading>
            <OutcomeBadge outcome={claim.outcome} />
            <ClaimKindBadge kind={ClaimKind.Emotive} />
          </div>
          <p className="text-sm text-muted-foreground">{metaLine || EMPTY}</p>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-3">
          {canEditBasic && !editingBasic ? (
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
          <EmotiveClaimStatusActions
            claimId={claim.id}
            currentOutcome={claim.outcome as ClaimOutcomeType}
            canChangeOutcome={canChangeOutcome}
            canReopen={canReopen}
            layout="inline"
          />
        </div>
      </div>
    </header>
  )
}
