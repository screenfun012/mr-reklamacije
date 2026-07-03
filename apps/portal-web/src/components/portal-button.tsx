import { cn } from '@mr/ui'
import type { ButtonHTMLAttributes } from 'react'

type PortalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

/**
 * Design-system buttons. Primary is NEUTRAL (light-on-dark / dark-on-light) —
 * the brandbook explicitly forbids red primary buttons; red is reserved for
 * accents. Secondary is the raised outline that turns red on hover.
 */
export function PortalButton({
  variant = 'primary',
  className,
  children,
  ...props
}: PortalButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[10px] font-sans text-sm font-bold uppercase tracking-[0.09em] transition-[background,color,border-color,transform] duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary'
          ? 'border-none bg-mrp-btn text-mrp-btnfg shadow-[0_12px_30px_rgba(0,0,0,0.28)] hover:-translate-y-px hover:bg-mrp-btnhv'
          : 'border border-mrp-border2 bg-mrp-raised text-mrp-text hover:border-mrp-red hover:bg-[rgba(237,28,36,0.06)] hover:text-mrp-redh',
        className,
      )}
    >
      {children}
    </button>
  )
}
