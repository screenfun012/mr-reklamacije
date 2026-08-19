import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Check } from 'lucide-react'
import type { ReactElement } from 'react'

import type { AssignableRole } from './assignable-roles'

export interface RolePackagePickerProps {
  options: readonly AssignableRole[]
  selected: readonly string[]
  disabled?: boolean
  /** Codes that cannot be picked right now, with the reason shown as their tooltip. */
  blocked?: ReadonlyMap<string, string>
  onToggle: (code: string) => void
}

/**
 * The list a person's privileges are picked from — one row per package, with the number of actions
 * it carries.
 *
 * One component for both places that pick packages (approving an account and editing an existing
 * one), because it is the same question asked twice: they had two different lists until today, and
 * only one of them showed what a package actually contains.
 */
export function RolePackagePicker({
  options,
  selected,
  disabled = false,
  blocked,
  onToggle,
}: RolePackagePickerProps): ReactElement {
  return (
    <div className="flex max-h-[340px] flex-col gap-[7px] overflow-y-auto">
      {options.map((option) => {
        const checked = selected.includes(option.code)
        const blockedReason = blocked?.get(option.code)
        const inputId = `role-package-${option.code}`

        return (
          <label
            key={option.code}
            htmlFor={inputId}
            title={blockedReason ?? option.description ?? undefined}
            className={cn(
              'flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors',
              checked
                ? 'border-adm-grn/40 bg-adm-grn/[0.08]'
                : 'border-border bg-adm-inbg hover:border-mr-border-strong',
              disabled || blockedReason !== undefined
                ? 'cursor-not-allowed opacity-45'
                : 'cursor-pointer',
            )}
          >
            <input
              id={inputId}
              type="checkbox"
              className="peer sr-only"
              checked={checked}
              disabled={disabled || blockedReason !== undefined}
              onChange={() => onToggle(option.code)}
            />
            <span
              aria-hidden="true"
              className="grid size-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] border-mr-border-strong text-transparent peer-checked:border-adm-grn peer-checked:bg-adm-grn peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-mr-brand/40"
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">
              {option.name}
            </span>
            <span className="flex-none font-mono text-[10px] font-semibold text-muted-foreground">
              {m.users_role_action_count({ count: option.permissionCount })}
            </span>
          </label>
        )
      })}
    </div>
  )
}
