import { m } from '@mr/i18n'
import { ClaimKind } from '@mr/shared'
import { cn } from '@mr/ui'

export interface StepKindProps {
  onPick: (kind: ClaimKind) => void
  canCreateEmotive: boolean
  canCreateDomace: boolean
}

const CARD_CLASSES =
  'flex cursor-pointer flex-col gap-[9px] rounded-[14px] border border-mri-border2 bg-mri-surface p-[22px] text-left transition-transform hover:-translate-y-0.5'

/**
 * Step 1 of the prototype's wizard: which kind of claim this is. The category is already known —
 * it comes from the menu entry or the list the wizard was opened from — so this step asks the one
 * thing that can never be changed afterwards.
 *
 * A permission the actor lacks removes its card rather than showing a dead one. Holding neither
 * cannot happen: the route refuses before this renders.
 */
export function StepKind({
  onPick,
  canCreateEmotive,
  canCreateDomace,
}: StepKindProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-mri-text2">{m.claim_wizard_kind_intro()}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {canCreateEmotive ? (
          <button
            type="button"
            onClick={() => onPick(ClaimKind.Emotive)}
            className={cn(CARD_CLASSES, 'hover:border-[rgba(46,144,250,.6)]')}
          >
            <span className="self-start rounded-full bg-[rgba(46,144,250,.13)] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-mri-info">
              {m.claims_kind_emotive()}
            </span>
            <span className="text-base font-extrabold text-mri-text">
              {m.claim_wizard_kind_emotive_title()}
            </span>
            <span className="text-[12.5px] leading-relaxed text-mri-text2">
              {m.claim_wizard_kind_emotive_hint()}
            </span>
          </button>
        ) : null}

        {canCreateDomace ? (
          <button
            type="button"
            onClick={() => onPick(ClaimKind.Domace)}
            className={cn(CARD_CLASSES, 'hover:border-[rgba(167,139,250,.6)]')}
          >
            <span className="self-start rounded-full bg-[rgba(167,139,250,.13)] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-mri-domace">
              {m.claims_kind_domace()}
            </span>
            <span className="text-base font-extrabold text-mri-text">
              {m.claim_wizard_kind_domace_title()}
            </span>
            <span className="text-[12.5px] leading-relaxed text-mri-text2">
              {m.claim_wizard_kind_domace_hint()}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
