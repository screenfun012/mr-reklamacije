import { toast } from '@mr/ui'
import { Check } from 'lucide-react'

/**
 * Design-system toast (DESIGN-GUIDELINES §5): bottom-center dark pill with a
 * green check, auto-dismissed after ~2.8s. The Toaster in __root.tsx is
 * mounted with position="bottom-center"; sonner provides the slide-up motion.
 */
export function showInternalToast(message: string): void {
  toast.custom(
    () => (
      <div className="flex items-center gap-[11px] rounded-[11px] border border-white/[0.14] bg-[#17171b] px-5 py-[13px] text-sm font-semibold text-white shadow-[0_18px_44px_rgba(0,0,0,0.5)]">
        <span
          aria-hidden="true"
          className="grid size-5 flex-none place-items-center rounded-full bg-[rgba(31,169,113,0.18)]"
        >
          <Check className="size-3.5 text-mri-ok" />
        </span>
        {message}
      </div>
    ),
    { duration: 2800 },
  )
}
