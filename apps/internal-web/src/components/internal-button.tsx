import { cn } from '@mr/ui'
import type { ButtonHTMLAttributes } from 'react'

export type InternalButtonVariant =
  | 'primary'
  | 'red'
  | 'green'
  | 'outline'
  | 'outline-red'
  | 'dashed'
  | 'ghost'

const BASE_CLASSES =
  'inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-[10px] font-sans font-bold uppercase tracking-[0.08em] transition-[background,color,border-color,transform] duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'

const VARIANT_CLASSES: Record<InternalButtonVariant, string> = {
  // Neutral fill — the brandbook forbids red primary buttons.
  primary:
    'border-none bg-mri-btn text-mri-btnfg shadow-[0_12px_30px_rgba(0,0,0,0.28)] hover:-translate-y-px hover:bg-mri-btnhv',
  red: 'border-none bg-mri-red text-white shadow-[0_10px_26px_rgba(237,28,36,0.28)] hover:-translate-y-px hover:bg-mri-redh',
  green: 'border-none bg-mri-ok text-white hover:-translate-y-px hover:bg-mri-ok-h',
  outline:
    'border border-mri-border2 bg-mri-raised text-mri-text hover:border-mri-red hover:bg-[rgba(237,28,36,0.06)] hover:text-mri-redh',
  'outline-red':
    'border border-[rgba(224,92,82,0.5)] bg-transparent text-mri-bad hover:bg-[rgba(224,92,82,0.08)]',
  dashed:
    'border border-dashed border-mri-border2 bg-transparent font-semibold normal-case tracking-normal text-mri-text2 hover:border-mri-red hover:text-mri-redh',
  ghost: 'border-none bg-transparent font-semibold text-mri-text2 hover:text-mri-redh',
}

/**
 * Single source of truth for design-system button styling (DESIGN-GUIDELINES
 * §5) — use via <InternalButton>, or via this helper on <Link>/<a> elements.
 * Pass sizing (height/padding/text size) through className; defaults suit
 * 52px form CTAs.
 */
export function internalButtonClasses(variant: InternalButtonVariant, className?: string): string {
  return cn(BASE_CLASSES, 'h-[52px] w-full text-sm', VARIANT_CLASSES[variant], className)
}

type InternalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: InternalButtonVariant
}

export function InternalButton({
  variant = 'primary',
  className,
  children,
  ...props
}: InternalButtonProps) {
  return (
    <button {...props} className={internalButtonClasses(variant, className)}>
      {children}
    </button>
  )
}
