import { m } from '@mr/i18n'
import type { ClaimListItem } from '@mr/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mr/ui'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.claims_delete_confirm_title()}</DialogTitle>
          <DialogDescription>
            {claim !== null ? m.claims_delete_confirm_message({ mrNumber: label }) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button type="button" variant="destructive" loading={deleting} onClick={onConfirm}>
            {m.action_delete()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
