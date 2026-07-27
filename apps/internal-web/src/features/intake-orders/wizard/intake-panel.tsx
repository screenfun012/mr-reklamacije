import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

/**
 * A wizard panel as the prototype draws it: `radius 15px`, `padding 20px 22px`, and the title
 * as a red mono caption INSIDE the card — not the bordered `InternalCardHeader` used on the
 * list and detail screens. The wizard is a different surface and the handoff treats it so.
 */
export function IntakePanel({
  title,
  badge,
  action,
  className,
  headerClassName,
  children,
}: {
  title: string
  /** Sits directly beside the title, not pushed right — step 3's vehicle-type chip. */
  badge?: ReactNode
  action?: ReactNode
  className?: string
  headerClassName?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[15px] border border-mri-border bg-mri-surface px-[22px] py-5',
        className,
      )}
    >
      <div className={cn('flex items-center gap-3', headerClassName)}>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
          {title}
        </span>
        {badge}
        {action !== undefined ? <span className="ml-auto">{action}</span> : null}
      </div>
      {children}
    </div>
  )
}
