import type { ReactNode } from 'react'

interface StubInputOtpProps {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  children?: ReactNode
}

/** Controlled input stub — avoids input-otp selection sync timers in unit tests. */
export function StubInputOTP({ value, onChange, disabled }: StubInputOtpProps): ReactNode {
  return (
    <input
      data-input-otp
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => {
        onChange?.(event.target.value)
      }}
    />
  )
}

export const stubInputOtpUiComponents = {
  InputOTP: StubInputOTP,
  InputOTPGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  InputOTPSeparator: () => null,
  InputOTPSlot: () => null,
}
