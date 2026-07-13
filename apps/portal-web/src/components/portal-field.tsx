import { cn } from '@mr/ui'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

/** Mono micro-label above a form input. */
export function PortalLabel({
  htmlFor,
  children,
  trailing,
}: {
  htmlFor: string
  children: ReactNode
  trailing?: ReactNode
}) {
  const label = (
    <label
      htmlFor={htmlFor}
      className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mrp-text2"
    >
      {children}
    </label>
  )

  if (trailing === undefined) {
    return <div className="mb-2">{label}</div>
  }
  return (
    <div className="mb-2 flex items-baseline justify-between">
      {label}
      {trailing}
    </div>
  )
}

/** 48px design input: --inbg background, red focus ring (see .mrp-input in globals). */
export function PortalInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'mrp-input h-12 w-full rounded-[9px] border border-mrp-border2 bg-mrp-inbg px-4 font-sans text-[15.5px] text-mrp-text outline-none transition-[border-color,box-shadow] duration-200',
        className,
      )}
    />
  )
}

/** Multiline sibling of PortalInput — same --inbg surface + red focus ring (.mrp-input). */
export function PortalTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'mrp-input min-h-[136px] w-full resize-y rounded-[9px] border border-mrp-border2 bg-mrp-inbg px-4 py-3 font-sans text-[15.5px] leading-[1.55] text-mrp-text outline-none transition-[border-color,box-shadow] duration-200',
        className,
      )}
    />
  )
}

/** Inline error under a field, matching the design's compact type scale. */
export function PortalFieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[12.5px] text-mrp-bad">{children}</p>
}
