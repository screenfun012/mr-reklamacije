import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

const NOTE_TONES = {
  info: {
    box: 'border-[rgba(46,144,250,0.26)] bg-[rgba(46,144,250,0.09)]',
    dot: 'bg-mri-info',
  },
  warn: {
    box: 'border-[rgba(245,166,35,0.26)] bg-[rgba(245,166,35,0.09)]',
    dot: 'bg-mri-warn',
  },
  error: {
    box: 'border-[rgba(224,92,82,0.26)] bg-[rgba(224,92,82,0.09)]',
    dot: 'bg-mri-bad',
  },
} as const

/** Tinted note box with a leading status dot (README register info-note pattern). */
export function InternalNote({
  tone,
  role,
  className,
  children,
}: {
  tone: keyof typeof NOTE_TONES
  role?: 'alert' | 'status'
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role={role}
      className={cn(
        'flex gap-[11px] rounded-[10px] border px-[15px] py-[13px]',
        NOTE_TONES[tone].box,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('mt-[5px] size-2 flex-none rounded-full', NOTE_TONES[tone].dot)}
      />
      <span className="text-[13.5px] leading-normal text-mri-text2">{children}</span>
    </div>
  )
}
