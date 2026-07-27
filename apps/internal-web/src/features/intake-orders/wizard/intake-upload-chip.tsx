import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

export interface IntakeUploadChipProps {
  /** Everything that has not landed, failures included. */
  outstanding: number
  failed: number
  waiting: number
  online: boolean
}

/**
 * The quiet report in the stepper strip on steps 4–5: how the photos taken back on step 3 are
 * getting on, while the serviser is looking at something else. Blue and pulsing means they are
 * simply going up; amber means they are not, and names which of the two reasons it is.
 */
export function IntakeUploadChip({
  outstanding,
  failed,
  waiting,
  online,
}: IntakeUploadChipProps): ReactElement {
  const stalled = failed > 0 || waiting > 0 || !online

  const label = ((): string => {
    if (failed > 0) {
      return m.intake_chip_failed({ count: failed })
    }
    if (stalled) {
      return m.intake_chip_waiting({ count: outstanding })
    }
    return m.intake_chip_uploading({ count: outstanding })
  })()

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-[7px] font-mono text-[10.5px] font-semibold tracking-[0.08em]',
        stalled
          ? 'border-[rgba(245,165,36,0.4)] bg-[rgba(245,165,36,0.12)] text-mri-amb'
          : 'border-[rgba(46,144,250,0.35)] bg-[rgba(46,144,250,0.12)] text-mri-info',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(!stalled && 'animate-pulse motion-reduce:animate-none')}
      >
        {stalled ? '⌁' : '⇡'}
      </span>
      {label}
    </span>
  )
}
