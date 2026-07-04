import { cn } from '@mr/ui'
import { Fragment } from 'react'

/**
 * Visual wizard stepper (README §7): 34px numbered circles — active red /
 * done green tint with ✓ / upcoming outlined — joined by hairlines that turn
 * green once passed.
 */
export function WizardStepper({
  steps,
  currentIndex,
}: {
  steps: readonly string[]
  currentIndex: number
}) {
  return (
    <div className="mb-[34px] flex items-center">
      {steps.map((label, index) => {
        const active = index === currentIndex
        const done = index < currentIndex
        return (
          <Fragment key={label}>
            <div className="flex flex-none items-center gap-[11px]">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-[34px] place-items-center rounded-full border font-mono text-xs font-bold',
                  active && 'border-mri-red bg-mri-red text-white',
                  done && 'border-[rgba(31,169,113,0.4)] bg-[rgba(31,169,113,0.15)] text-mri-ok',
                  !active && !done && 'border-mri-border2 bg-transparent text-mri-text2',
                )}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[13.5px]',
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
                  'mx-4 h-px flex-1',
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
