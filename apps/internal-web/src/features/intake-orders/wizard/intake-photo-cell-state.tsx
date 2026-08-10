import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import type { IntakePhotoCell } from './intake-photo-grid'
import type { IntakePhotoQueueEntry } from './use-intake-photo-queue'

const STATE_BORDER: Record<IntakePhotoQueueEntry['state'], string> = {
  ok: 'border-mri-border2',
  up: 'border-mri-border2',
  wait: 'border-[rgba(245,165,36,0.6)]',
  err: 'border-mri-red',
}

const STATE_VEIL: Record<IntakePhotoQueueEntry['state'], string> = {
  ok: '',
  up: 'bg-[rgba(11,11,13,0.5)]',
  wait: 'bg-[rgba(11,11,13,0.45)]',
  err: 'bg-[rgba(237,28,36,0.32)]',
}

const STATE_TEXT: Record<IntakePhotoQueueEntry['state'], string> = {
  ok: '',
  up: 'text-mri-text',
  wait: 'text-mri-amb',
  err: 'text-white',
}

/** The cell's frame, which is where "still on its way" and "stopped" are first visible. */
export function photoCellBorderClass(state: IntakePhotoQueueEntry['state']): string {
  return STATE_BORDER[state]
}

function stateLabel(cell: IntakePhotoCell): string {
  if (cell.state === 'err') {
    return `! ${m.intake_photo_state_failed()}`
  }
  if (cell.state === 'wait') {
    return `⌁ ${m.intake_photo_state_waiting()}`
  }
  return `${cell.progress}%`
}

/**
 * What a photo that has not landed says about itself. Shared by the wizard's grid and the detail's
 * photo tab: the office uploads through the same queue, and a cell is the only place a failure is
 * reported where the operator can act on it.
 */
export function IntakePhotoCellOverlay({ cell }: { cell: IntakePhotoCell }): ReactElement | null {
  if (cell.state === 'ok') {
    return null
  }

  return (
    <>
      <span
        className={cn(
          'absolute inset-0 grid place-items-center px-1 text-center font-mono text-[10px] font-bold uppercase leading-[1.4] tracking-[0.08em]',
          STATE_VEIL[cell.state],
          STATE_TEXT[cell.state],
        )}
      >
        {stateLabel(cell)}
      </span>

      {cell.state === 'up' ? (
        <span
          className="absolute bottom-0 left-0 h-[3px] bg-mri-info transition-[width] duration-200"
          style={{ width: `${cell.progress}%` }}
        />
      ) : null}
    </>
  )
}
