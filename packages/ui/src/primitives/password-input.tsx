import { m } from '@mr/i18n'
import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useState } from 'react'

import { cn } from '../lib/cn.js'
import { Input, type InputProps } from './input.js'

export type PasswordInputProps = Omit<InputProps, 'type'>

/** Password field with a show/hide reveal toggle (Eye/EyeOff), for @mr/ui-styled forms. */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={revealed ? 'text' : 'password'}
          className={cn('pr-10', className)}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          aria-label={revealed ? m.action_hide_password() : m.action_show_password()}
          disabled={disabled}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
