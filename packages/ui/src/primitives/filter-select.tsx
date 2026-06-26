import * as React from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger } from './select.js'

export interface FilterSelectOption {
  value: string
  label: string
}

export interface FilterSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: readonly FilterSelectOption[]
  /** Shown when value is empty or not found in options (also prevents trigger flash). */
  placeholder: string
  'aria-label': string
  label?: string | undefined
  id?: string | undefined
  className?: string | undefined
  disabled?: boolean | undefined
}

function resolveDisplayLabel(
  value: string,
  options: readonly FilterSelectOption[],
  placeholder: string,
): string {
  const match = options.find((option) => option.value === value)
  if (match !== undefined) {
    return match.label
  }

  if (value.trim() === '') {
    return placeholder
  }

  return placeholder
}

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  'aria-label': ariaLabel,
  label,
  id,
  className,
  disabled = false,
}: FilterSelectProps): React.ReactElement {
  const displayLabel = resolveDisplayLabel(value, options, placeholder)

  const select = (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <span className="truncate">{displayLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (label === undefined) {
    return select
  }

  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {select}
    </div>
  )
}
