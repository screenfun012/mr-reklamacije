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
  chip,
  trailing,
}: {
  steps: readonly string[]
  /** 1-based, as the serviser counts them. */
  currentStep: number
  /** Upload status, between the last step and the order number — where the prototype puts it. */
  chip?: ReactNode
  trailing: ReactNode
}) {
  return (
    /* Pinned under the topbar. The wizard used to seize the viewport height and own its scroll,
       which kept this strip — and with it the order-number field — on screen the whole way
       through; now that the page scrolls normally, `sticky` is what preserves that. Offset and
       surface are borrowed rather than guessed: --mri-topbar-h is the one place the header
       height lives, and bg/blur match the footer so content passes under both the same way.

       `flex-wrap`: four 34px circles, four connectors whose 12px margins never shrink and the
       132px order-number field need 422px before a single glyph of label, and a phone offers ~326.
       `min-w-0` on the steps turned that deficit into overlap — the circles sat on top of each
       other and the fourth ran over the field's label (photographed at 395px, 2026-08-22).
       Wrapped, the field takes its own line and the steps space out evenly; wherever the row
       fits, the class is inert. */
    <div className="sticky top-[var(--mri-topbar-h)] z-10 flex flex-wrap items-center gap-x-0 gap-y-3 border-b border-mri-border bg-mri-hdr px-4 py-3.5 backdrop-blur-[14px] sm:px-[26px]">
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
      {chip !== undefined ? <div className="mr-3.5 flex-none">{chip}</div> : null}
      <div className="flex-none">{trailing}</div>
    </div>
  )
}
