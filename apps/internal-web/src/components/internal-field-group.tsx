import { cn } from '@mr/ui'
import type { ReactNode } from 'react'

import { InternalFieldLabel } from '~/components/internal-field'

/**
 * Labeled form field in the design language: mono uppercase label above the
 * control (` *` marks required fields), red error message below.
 */
export function InternalFieldGroup({
  id,
  label,
  required = false,
  error,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string | undefined
  className?: string | undefined
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-[7px]', className)}>
      <InternalFieldLabel htmlFor={id}>
        {label}
        {required ? <span className="text-mri-redh"> *</span> : null}
      </InternalFieldLabel>
      {children}
      {error !== undefined && error.length > 0 ? (
        <span className="text-[13px] text-mri-bad">{error}</span>
      ) : null}
    </div>
  )
}
