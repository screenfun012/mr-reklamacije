import { cn } from '@mr/ui'

import { InternalFieldLabel, InternalInput } from '~/components/internal-field'

/** Labeled input in the auth-form size (48px, 15px text): mono uppercase label. */
export function AuthTextField({
  id,
  label,
  type = 'text',
  autoComplete,
  placeholder,
  value,
  onChange,
  onBlur,
  disabled,
  error,
  className,
}: {
  id: string
  label: string
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  disabled: boolean
  error: string | null
  className?: string
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <InternalFieldLabel htmlFor={id} className="mb-2 text-[10.5px] tracking-[0.14em]">
        {label}
      </InternalFieldLabel>
      <InternalInput
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onBlur={onBlur}
        disabled={disabled}
        className="h-12 px-4 text-[15px] font-normal"
      />
      {error !== null ? <span className="mt-1.5 text-[13px] text-mri-bad">{error}</span> : null}
    </div>
  )
}
