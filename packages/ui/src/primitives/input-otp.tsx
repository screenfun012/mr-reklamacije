import { OTPInput, OTPInputContext } from 'input-otp'
import * as React from 'react'

import { cn } from '../lib/cn.js'

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      'flex items-center gap-2 has-[:disabled]:opacity-50',
      containerClassName,
    )}
    className={cn('disabled:cursor-not-allowed', className)}
    {...props}
  />
))
InputOTP.displayName = 'InputOTP'

const InputOTPGroup = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-1.5', className)} {...props} />
))
InputOTPGroup.displayName = 'InputOTPGroup'

const InputOTPSlot = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const slot = inputOTPContext?.slots[index]
  if (!slot) {
    return (
      <div
        ref={ref}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm',
          className,
        )}
        {...props}
      />
    )
  }
  const { char, hasFakeCaret, isActive } = slot
  return (
    <div
      ref={ref}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm shadow-sm transition-colors',
        isActive && 'z-10 border-ring ring-1 ring-ring',
        className,
      )}
      {...props}
    >
      {char !== null ? <span>{char}</span> : null}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-pulse bg-foreground" />
        </div>
      ) : null}
    </div>
  )
})
InputOTPSlot.displayName = 'InputOTPSlot'

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-hidden
    className="select-none text-muted-foreground"
    {...props}
  >
    —
  </div>
))
InputOTPSeparator.displayName = 'InputOTPSeparator'

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
