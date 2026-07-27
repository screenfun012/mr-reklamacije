import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

export type IntakeHintTone = 'muted' | 'warn' | 'bad' | 'ok'

const HINT_COLOURS: Record<IntakeHintTone, string> = {
  muted: 'text-mri-text2',
  warn: 'text-mri-warn',
  bad: 'text-mri-redh',
  ok: 'text-mri-ok',
}

/**
 * The wizard's footer — a plain flex sibling at the bottom of the wizard column, exactly as the
 * prototype has it.
 *
 * NOT `fixed`: a fixed bar spans the viewport and covered the sidebar, including the logout,
 * which left a serviser with no way to sign out. NOT `sticky` either — measured, it does not
 * pin inside this shell, whose main column is `overflow-x: clip`. The wizard column owns its
 * own scroll instead, which is what makes this footer stay put.
 */
export function IntakeWizardFooter({
  hint,
  hintTone,
  backDisabled,
  nextDisabled,
  finish,
  onDiscard,
  onBack,
  onNext,
}: {
  hint: string
  hintTone: IntakeHintTone
  backDisabled: boolean
  nextDisabled: boolean
  /** Present only on the last step, where it REPLACES "Dalje" rather than relabelling it. */
  finish?: { label: string; waiting: boolean; ready: boolean; onClick: () => void }
  onDiscard: () => void
  onBack: () => void
  onNext: () => void
}): ReactElement {
  return (
    <div className="z-20 flex flex-none flex-wrap items-center gap-3 border-t border-mri-border bg-mri-hdr px-4 py-3.5 backdrop-blur-[14px] sm:px-[26px]">
      <span className={cn('font-mono text-[11.5px] tracking-[0.05em]', HINT_COLOURS[hintTone])}>
        {hint}
      </span>

      <button
        type="button"
        onClick={onDiscard}
        className="ml-auto h-[52px] cursor-pointer rounded-[11px] border border-mri-border2 bg-transparent px-5 text-[13.5px] font-bold uppercase tracking-[0.06em] text-mri-text2 transition-colors hover:text-mri-redh"
      >
        {m.intake_action_discard()}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="h-[52px] cursor-pointer rounded-[11px] border border-mri-border2 bg-mri-inbg px-6 text-sm font-bold uppercase tracking-[0.06em] text-mri-text2 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {m.intake_action_back()}
      </button>

      {finish === undefined ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="h-[52px] cursor-pointer rounded-[11px] border-0 bg-mri-btn px-8 text-sm font-extrabold uppercase tracking-[0.06em] text-mri-btnfg shadow-[0_8px_22px_rgba(0,0,0,0.35)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {m.intake_action_next()}
        </button>
      ) : (
        /*
          Never `disabled`: it refuses in the handler and says why. A dead button in front of a
          waiting customer tells the serviser nothing, and the two reasons it can refuse — a
          missing signature, a photo still going up — are both things he can act on.
        */
        <button
          type="button"
          onClick={finish.onClick}
          className={cn(
            'h-[52px] cursor-pointer rounded-[11px] border px-[26px] text-sm font-extrabold uppercase tracking-[0.06em] transition-opacity motion-reduce:transition-none',
            finish.waiting
              ? 'border-[rgba(245,165,36,0.45)] bg-[rgba(245,165,36,0.14)] text-mri-amb'
              : 'border-[rgba(31,169,113,0.45)] bg-[rgba(31,169,113,0.16)] text-mri-grn',
            finish.ready ? 'opacity-100' : 'opacity-50',
          )}
        >
          {finish.label}
        </button>
      )}
    </div>
  )
}
