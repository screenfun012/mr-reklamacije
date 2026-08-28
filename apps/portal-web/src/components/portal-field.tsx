import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
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

const PORTAL_INPUT_CLASSES =
  'mrp-input h-12 w-full rounded-[9px] border border-mrp-border2 bg-mrp-inbg px-4 font-sans text-[15.5px] text-mrp-text outline-none transition-[border-color,box-shadow] duration-200'

/** 48px design input: --inbg background, red focus ring (.mrp-input); password fields get a reveal toggle. */
export function PortalInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [revealed, setRevealed] = useState(false)

  if (props.type !== 'password') {
    return <input {...props} className={cn(PORTAL_INPUT_CLASSES, className)} />
  }

  return (
    <div className="relative">
      <input
        {...props}
        type={revealed ? 'text' : 'password'}
        className={cn(PORTAL_INPUT_CLASSES, 'pr-12', className)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-mrp-text2 transition-colors hover:text-mrp-text disabled:opacity-50"
        aria-label={revealed ? m.action_hide_password() : m.action_show_password()}
        disabled={props.disabled}
        onClick={() => setRevealed((current) => !current)}
      >
        {/* Both eyes stay mounted and cross-fade — a hard swap flickers on slow paints. */}
        <span className="relative grid size-[18px] place-items-center" aria-hidden="true">
          <Eye
            className={cn(
              'col-start-1 row-start-1 size-[18px] transition-opacity duration-150',
              revealed ? 'opacity-0' : 'opacity-100',
            )}
          />
          <EyeOff
            className={cn(
              'col-start-1 row-start-1 size-[18px] transition-opacity duration-150',
              revealed ? 'opacity-100' : 'opacity-0',
            )}
          />
        </span>
      </button>
    </div>
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
