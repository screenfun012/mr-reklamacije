import { toast } from '@mr/ui'

import { MaskedIcon } from '~/components/masked-icon'

/**
 * Portal design-system toast: a bottom-center pill on the raised surface with a
 * green check, auto-dismissed after ~2.8s. Uses the portal `--mrp-*` tokens so
 * it flips with the dark/light theme like the rest of the portal. The Toaster
 * is mounted once in `__root.tsx`; sonner provides the slide-up motion.
 */
export function showPortalToast(message: string): void {
  toast.custom(
    () => (
      <div className="flex items-center gap-3 rounded-[11px] border border-mrp-border2 bg-mrp-raised px-[18px] py-3 text-sm font-medium text-mrp-text shadow-[var(--mrp-shadow)]">
        <span
          aria-hidden="true"
          className="grid size-[22px] flex-none place-items-center rounded-full bg-mrp-ok-bg text-mrp-ok"
        >
          <MaskedIcon name="check" className="size-3" />
        </span>
        {message}
      </div>
    ),
    { duration: 2800 },
  )
}
