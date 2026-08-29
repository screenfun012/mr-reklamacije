import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

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
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={cn('flex flex-col', className)}>
      <InternalFieldLabel htmlFor={id} className="mb-2 text-[10.5px] tracking-[0.14em]">
        {label}
      </InternalFieldLabel>
      <div className="relative">
        <InternalInput
          id={id}
          type={isPassword && revealed ? 'text' : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onBlur={onBlur}
          disabled={disabled}
          className={cn('h-12 px-4 text-[15px] font-normal', isPassword && 'pr-12')}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3.5 text-mri-text2 transition-colors hover:text-mri-text disabled:opacity-50"
            aria-label={revealed ? m.action_hide_password() : m.action_show_password()}
            disabled={disabled}
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
        ) : null}
      </div>
      {error !== null ? <span className="mt-1.5 text-[13px] text-mri-bad">{error}</span> : null}
    </div>
  )
}
