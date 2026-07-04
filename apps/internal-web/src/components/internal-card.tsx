import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

/**
 * Design-system card (DESIGN-GUIDELINES §5): surface background + hairline
 * border, radius 12–15px, NO shadow. The single source of truth for every
 * card-shaped container in the internal app.
 */
export function InternalCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-[14px] border border-mri-border bg-mri-surface', className)}
    >
      {children}
    </div>
  )
}

/** Card header row: 15px w800 title left, optional action/meta right, hairline below. */
export function InternalCardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-mri-border px-5 py-4',
        className,
      )}
    >
      <h2 className="text-[15px] font-extrabold text-mri-text">{title}</h2>
      {action}
    </div>
  )
}
