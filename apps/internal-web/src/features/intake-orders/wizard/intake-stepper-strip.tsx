import { cn } from '@mr/ui'
import { Fragment, type ReactNode } from 'react'

/**
 * The wizard's own stepper strip, matching `prijem-prototip-v2` exactly: the five steps
 * spread across the full width (`flex: 1 1 auto` each) with a hairline connector between
 * them that turns green once a step is done, and the order-number field sitting inline at
 * the right-hand end of the same strip.
 *
 * Deliberately not the shared `WizardStepper`: that one packs the steps to the left for the
 * claims wizard. Changing it would move a screen this phase has nothing to do with.
 */
export function IntakeStepperStrip({
  steps,
  currentStep,
  trailing,
}: {
  steps: readonly string[]
  /** 1-based, as the serviser counts them. */
  currentStep: number
  trailing: ReactNode
}) {
  return (
    <div className="flex items-center gap-0 border-b border-mri-border px-4 py-3.5 sm:px-[26px]">
      {steps.map((label, index) => {
        const number = index + 1
        const done = currentStep > number
        const active = currentStep === number

        return (
          <Fragment key={label}>
            <div className="flex min-w-0 flex-[1_1_auto] items-center">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-[34px] flex-none place-items-center rounded-full border font-mono text-sm font-bold',
                  active && 'border-mri-red bg-mri-red text-white',
                  done && 'border-[rgba(31,169,113,0.4)] bg-[rgba(31,169,113,0.15)] text-mri-ok',
                  !active && !done && 'border-mri-border2 bg-transparent text-mri-text2',
                )}
              >
                {done ? '✓' : number}
              </span>
              <span
                className={cn(
                  'ml-2.5 hidden whitespace-nowrap text-[13px] md:inline',
                  active ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
                )}
              >
                {label}
              </span>
              {/* The connector: every step has one, so the line also runs into the number field. */}
              <span
                aria-hidden="true"
                className={cn(
                  'mx-3 h-px min-w-3 flex-1',
                  done ? 'bg-[rgba(31,169,113,0.4)]' : 'bg-mri-border2',
                )}
              />
            </div>
          </Fragment>
        )
      })}
      <div className="flex-none">{trailing}</div>
    </div>
  )
}
