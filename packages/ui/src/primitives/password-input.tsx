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
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          aria-label={revealed ? m.action_hide_password() : m.action_show_password()}
          disabled={disabled}
          onClick={() => setRevealed((current) => !current)}
        >
          {/* Both eyes stay mounted and cross-fade — a hard swap flickers on slow paints. */}
          <span className="relative grid size-4 place-items-center">
            <Eye
              aria-hidden="true"
              className={cn(
                'col-start-1 row-start-1 size-4 transition-opacity duration-150',
                revealed ? 'opacity-0' : 'opacity-100',
              )}
            />
            <EyeOff
              aria-hidden="true"
              className={cn(
                'col-start-1 row-start-1 size-4 transition-opacity duration-150',
                revealed ? 'opacity-100' : 'opacity-0',
              )}
            />
          </span>
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
