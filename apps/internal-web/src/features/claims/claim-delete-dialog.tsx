import { m } from '@mr/i18n'
import type { ClaimListItem } from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'

interface ClaimDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claim: ClaimListItem | null
  deleting: boolean
  onConfirm: () => void
}

/** Confirm-before-soft-delete for a claim in the unified list. */
export function ClaimDeleteDialog({
  open,
  onOpenChange,
  claim,
  deleting,
  onConfirm,
}: ClaimDeleteDialogProps) {
  const label = claim?.mrNumber ?? claim?.claimNumber ?? '—'

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.claims_delete_confirm_title()}
      description={claim !== null ? m.claims_delete_confirm_message({ mrNumber: label }) : null}
      confirmLabel={m.action_delete()}
      pending={deleting}
      onConfirm={onConfirm}
    />
  )
}
