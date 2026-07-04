import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

/**
 * Drop-in replacements for the @mr/ui Card family, styled per the internal
 * design system (surface + hairline border, no shadow, 15px w800 titles).
 * Statistika chart files import these under the same names so their JSX
 * stays untouched.
 */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-[14px] border border-mri-border bg-mri-surface', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-5', className)}>{children}</div>
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-[15px] font-extrabold text-mri-text', className)}>{children}</h3>
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 pb-6 pt-4', className)}>{children}</div>
}
