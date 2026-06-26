import * as React from 'react'

import { ListSelect } from './list-select.js'

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
  const select = (
    <ListSelect
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      aria-label={ariaLabel}
      id={id}
      className={className}
      disabled={disabled}
    />
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
