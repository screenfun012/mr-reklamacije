import { m } from '@mr/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mr/ui'
import { useState } from 'react'

import { InternalFieldLabel } from '~/components/internal-field'
import { TEXTAREA_FIELD_CLASS } from '~/features/emotive-claims/create/form-field-styles'

export interface RejectSubmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rejecting: boolean
  onConfirm: (reason: string | undefined) => void
}

/** Confirm-before-dismiss dialog with an optional internal reason (docs/18 §9). */
export function RejectSubmissionDialog({
  open,
  onOpenChange,
  rejecting,
  onConfirm,
}: RejectSubmissionDialogProps): React.ReactElement {
  const [reason, setReason] = useState('')

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      setReason('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.internal_inbox_reject_title()}</DialogTitle>
          <DialogDescription>{m.internal_inbox_reject_description()}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[7px]">
          <InternalFieldLabel htmlFor="reject-reason">
            {m.internal_inbox_reject_reason_label()}
          </InternalFieldLabel>
          <textarea
            id="reject-reason"
            className={TEXTAREA_FIELD_CLASS}
            placeholder={m.internal_inbox_reject_reason_placeholder()}
            value={reason}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            disabled={rejecting}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={rejecting}
            onClick={() => handleOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={rejecting}
            onClick={() => onConfirm(reason.trim().length > 0 ? reason.trim() : undefined)}
          >
            {m.internal_inbox_reject_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
