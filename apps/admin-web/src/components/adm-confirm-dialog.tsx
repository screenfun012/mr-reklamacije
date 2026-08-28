import { m } from '@mr/i18n'
import { cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@mr/ui'
import type { ReactElement, ReactNode } from 'react'

import { admSecondaryButtonClassName } from '~/lib/adm-chrome'

/**
 * How heavy the action is. It decides the colour of the tag and of the confirm button — and it is
 * the only place in this panel where a filled red appears, at a sixth of its strength.
 */
export type AdmConfirmTone = 'destructive' | 'warning' | 'neutral'

const TAG_CLASSES: Record<AdmConfirmTone, string> = {
  destructive: 'text-adm-red-h',
  warning: 'text-adm-amb',
  neutral: 'text-muted-foreground',
}

const CONFIRM_CLASSES: Record<AdmConfirmTone, string> = {
  destructive: 'border-mr-brand bg-mr-brand/[0.16] text-adm-red-h',
  warning: 'border-adm-amb/45 bg-adm-amb/15 text-adm-amb',
  neutral: 'border-mr-border-strong bg-adm-inbg text-foreground',
}

export interface AdmConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mono caps line above the question — what KIND of action this is. */
  tag: string
  tone?: AdmConfirmTone
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  pending?: boolean
  onConfirm: () => void
}

/**
 * Confirm-before-acting, in the prototype's shape (`design_handoff_admin_panel/`): a mono tag naming
 * the weight of the action, the question, one sentence of consequence, and two equal buttons.
 *
 * Admin's own rather than `@mr/ui`'s `ConfirmDialog`, which ten internal-web screens use: that one
 * renders a fully filled brand-red confirm beside a red-outlined Cancel, which is the "too much red"
 * Nikola named — and here it appeared on a routine deactivation. Changing it in place would move ten
 * screens in an app nobody asked to touch, so this panel gets its own, exactly as internal-web keeps
 * its own chrome. The Dialog primitive underneath is shared, so portal, focus trap and Escape behave
 * identically.
 */
export function AdmConfirmDialog({
  open,
  onOpenChange,
  tag,
  tone = 'destructive',
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
}: AdmConfirmDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        unstyled
        hideClose
        className="left-1/2 top-1/2 flex w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-[15px] border border-mr-border-strong bg-adm-raised px-[26px] py-6 shadow-[0_28px_70px_rgba(0,0,0,.5)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=open]:duration-[250ms] motion-reduce:animate-none"
      >
        <p
          className={cn(
            'font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]',
            TAG_CLASSES[tone],
          )}
        >
          {tag}
        </p>
        <DialogTitle className="text-[17px] font-extrabold leading-[1.35]">{title}</DialogTitle>
        <DialogDescription className="text-[13px] leading-[1.6] text-muted-foreground">
          {description ?? null}
        </DialogDescription>
        <div className="mt-1.5 flex gap-2.5">
          <button
            type="button"
            className={admSecondaryButtonClassName}
            disabled={pending}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {cancelLabel ?? m.action_cancel()}
          </button>
          <button
            type="button"
            className={cn(
              'h-[46px] flex-1 cursor-pointer rounded-[10px] border px-5 text-[12.5px] font-extrabold uppercase tracking-[0.05em] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
              CONFIRM_CLASSES[tone],
            )}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
