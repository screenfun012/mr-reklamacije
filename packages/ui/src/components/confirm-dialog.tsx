import { m } from '@mr/i18n'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog.js'
import { Button } from '../primitives/button.js'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel: React.ReactNode
  /** Defaults to the shared "Cancel" label. */
  cancelLabel?: React.ReactNode
  /** Confirm button style — destructive (default) for irreversible actions. */
  variant?: 'destructive' | 'default'
  pending?: boolean
  onConfirm: () => void
}

/**
 * Shared confirm-before-acting dialog for destructive/irreversible actions.
 * Controlled (open/onOpenChange); the confirm button shows a spinner while pending.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'destructive',
  pending = false,
  onConfirm,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? null}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? m.action_cancel()}
          </Button>
          <Button type="button" variant={variant} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
