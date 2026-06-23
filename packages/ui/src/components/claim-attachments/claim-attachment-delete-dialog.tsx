import type { AttachmentListItem } from '@mr/shared'
import { m } from '@mr/i18n'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog.js'
import { Button } from '../../primitives/button.js'

export interface ClaimAttachmentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachment: AttachmentListItem | null
  deleting?: boolean
  onConfirm: () => void
}

export function ClaimAttachmentDeleteDialog({
  open,
  onOpenChange,
  attachment,
  deleting = false,
  onConfirm,
}: ClaimAttachmentDeleteDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.claim_attachments_delete_confirm_title()}</DialogTitle>
          <DialogDescription>
            {attachment !== null
              ? m.claim_attachments_delete_confirm_message({ fileName: attachment.fileName })
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            {m.claim_attachments_delete_cancel()}
          </Button>
          <Button type="button" variant="destructive" loading={deleting} onClick={onConfirm}>
            {m.claim_attachments_delete_confirm_action()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
