import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

/**
 * Statistika-specific card primitives, styled per the internal design system
 * (surface + hairline border, no shadow, 15px w800 titles). Named `StatCard*`
 * so they never shadow the @mr/ui `Card` family — the two legitimately coexist
 * in this feature (e.g. the trend-charts skeleton uses the real @mr/ui Card).
 */
export function StatCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-[14px] border border-mri-border bg-mri-surface', className)}>
      {children}
    </div>
  )
}

export function StatCardHeader({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-5', className)}>{children}</div>
}

export function StatCardTitle({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <h3 className={cn('text-[15px] font-extrabold text-mri-text', className)}>{children}</h3>
}

export function StatCardContent({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('px-6 pb-6 pt-4', className)}>{children}</div>
}
