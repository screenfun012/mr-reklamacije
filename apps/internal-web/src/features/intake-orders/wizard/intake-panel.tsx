import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

/**
 * A wizard panel as the prototype draws it: `radius 15px`, `padding 20px 22px`, and the title
 * as a red mono caption INSIDE the card — not the bordered `InternalCardHeader` used on the
 * list and detail screens. The wizard is a different surface and the handoff treats it so.
 */
export function IntakePanel({
  title,
  action,
  className,
  children,
}: {
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[15px] border border-mri-border bg-mri-surface px-[22px] py-5',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
          {title}
        </span>
        {action !== undefined ? <span className="ml-auto">{action}</span> : null}
      </div>
      {children}
    </div>
  )
}
