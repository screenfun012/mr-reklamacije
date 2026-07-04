import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

export type InternalPillTone = 'ok' | 'bad' | 'warn' | 'info' | 'domace' | 'archived' | 'neutral'

/** Tinted-pill pattern (DESIGN-GUIDELINES §2/§5): rgba(color,.13) bg + solid color text. */
const PILL_TONES: Record<InternalPillTone, { box: string; dot: string }> = {
  ok: { box: 'bg-mri-ok-bg text-mri-ok', dot: 'bg-mri-ok' },
  bad: { box: 'bg-mri-bad-bg text-mri-bad', dot: 'bg-mri-bad' },
  warn: { box: 'bg-mri-warn-bg text-mri-warn', dot: 'bg-mri-warn' },
  info: { box: 'bg-mri-info-bg text-mri-info', dot: 'bg-mri-info' },
  domace: { box: 'bg-mri-domace-bg text-mri-domace', dot: 'bg-mri-domace' },
  archived: { box: 'bg-mri-archived-bg text-mri-archived', dot: 'bg-mri-archived' },
  neutral: { box: 'bg-mri-inbg text-mri-text2', dot: 'bg-mri-text2' },
}

export function InternalPill({
  tone,
  dot = false,
  className,
  children,
}: {
  tone: InternalPillTone
  /** Leading 6px status dot (outcome pills). */
  dot?: boolean
  className?: string | undefined
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em]',
        PILL_TONES[tone].box,
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn('size-1.5 flex-none rounded-full', PILL_TONES[tone].dot)}
        />
      ) : null}
      {children}
    </span>
  )
}
