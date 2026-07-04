import { cn } from '@mr/ui'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/**
 * Single source of truth for form-control styling (DESIGN-GUIDELINES §5):
 * tinted input background, --border2 frame, radius 9px, red focus ring via
 * the global `.mri-input` rule. Default height 40px (toolbars/filters) —
 * override via className for 44–48px form fields.
 */
export const INTERNAL_CONTROL_CLASSES =
  'mri-input h-10 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 font-sans text-[13.5px] font-medium text-mri-text outline-none transition-[border-color,box-shadow] duration-200 disabled:opacity-60'

/** Field label ABOVE the control: mono 9.5px uppercase (README filter/form cards). */
export function InternalFieldLabel({
  htmlFor,
  className,
  children,
}: {
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2',
        className,
      )}
    >
      {children}
    </label>
  )
}

export function InternalInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(INTERNAL_CONTROL_CLASSES, 'w-full', className)} />
}

export function InternalSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(INTERNAL_CONTROL_CLASSES, 'w-full cursor-pointer', className)}>
      {children}
    </select>
  )
}
