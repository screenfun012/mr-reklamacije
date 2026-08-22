import { cn } from '@mr/ui'
import { Fragment } from 'react'

/**
 * The two wizards in this app draw their step strip differently, and both were approved that
 * way: the intake wizard on a tablet in the yard (34px circles, plain labels), the claims wizard
 * from the office prototype (26px circles, mono labels). These are two DESIGNS, not a size knob —
 * pick the one belonging to the screen, never to fit a layout.
 */
export type WizardStepperVariant = 'intake' | 'claims'

const CIRCLE_CLASSES: Record<WizardStepperVariant, string> = {
  intake: 'size-[34px] text-xs',
  claims: 'size-[26px] text-[11px]',
}

const LABEL_CLASSES: Record<WizardStepperVariant, string> = {
  intake: 'text-[13.5px]',
  // Hidden below md, like the intake strip beside it: the four Serbian labels need ~440px and a
  // 390px phone offers 358, so the fourth step ("Pregled") was clipped away entirely — the shell
  // clips, it does not scroll, so it could not even be swiped to. The step name is not lost: the
  // wizard prints it as the H1 directly above this strip.
  claims: 'hidden font-mono text-[9.5px] uppercase tracking-[0.13em] md:inline',
}

const ROW_CLASSES: Record<WizardStepperVariant, string> = {
  intake: 'mb-[34px] gap-[11px]',
  claims: 'gap-[9px] px-0.5 py-1',
}

export function WizardStepper({
  steps,
  currentIndex,
  variant = 'intake',
}: {
  steps: readonly string[]
  currentIndex: number
  variant?: WizardStepperVariant
}) {
  return (
    <div className={cn('flex items-center', variant === 'intake' && 'mb-[34px]')}>
      {steps.map((label, index) => {
        const active = index === currentIndex
        const done = index < currentIndex
        return (
          <Fragment key={label}>
            <div className={cn('flex flex-none items-center', ROW_CLASSES[variant])}>
              <span
                aria-hidden="true"
                className={cn(
                  'grid place-items-center rounded-full border font-mono font-bold',
                  CIRCLE_CLASSES[variant],
                  active && 'border-mri-red bg-mri-red text-white',
                  done && 'border-[rgba(31,169,113,0.4)] bg-[rgba(31,169,113,0.15)] text-mri-ok',
                  !active && !done && 'border-mri-border2 bg-transparent text-mri-text2',
                )}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap',
                  LABEL_CLASSES[variant],
                  active ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px flex-1',
                  variant === 'intake' ? 'mx-4' : 'mx-3',
                  done ? 'bg-[rgba(31,169,113,0.4)]' : 'bg-mri-border',
                )}
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
