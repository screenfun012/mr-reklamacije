import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '../lib/cn.js'
import { buttonVariants, type ButtonVariantProps } from './button-variants.js'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  asChild?: boolean
  /** Shows spinner and preserves label width to avoid layout shift. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    const isDisabled = disabled === true || loading

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="inline-grid grid-cols-1 grid-rows-1 items-center justify-items-center">
            <span
              className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
              aria-hidden
            >
              {children}
            </span>
            <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              {children}
            </span>
          </span>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button }
