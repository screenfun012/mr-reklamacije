import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '../lib/cn.js'
import { fieldControlClassName, fieldPopoverContentClassName } from '../lib/field-control-styles.js'
import { Button } from './button.js'
import { ListSelectOptionButton } from './list-select-option-button.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'

export interface ListSelectOption {
  value: string
  label: string
}

export interface ListSelectProps {
  value: string
  options: readonly ListSelectOption[]
  onValueChange: (value: string) => void
  placeholder: string
  'aria-label': string
  id?: string | undefined
  className?: string | undefined
  disabled?: boolean | undefined
  onBlur?: (() => void) | undefined
}

function resolveDisplayLabel(
  value: string,
  options: readonly ListSelectOption[],
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

export function ListSelect({
  value,
  options,
  onValueChange,
  placeholder,
  'aria-label': ariaLabel,
  id,
  className,
  disabled = false,
  onBlur,
}: ListSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false)

  const displayLabel = useMemo(
    () => resolveDisplayLabel(value, options, placeholder),
    [options, placeholder, value],
  )

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen)
    if (!nextOpen) {
      onBlur?.()
    }
  }

  const selectValue = (nextValue: string): void => {
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          id={id}
          disabled={disabled}
          className={cn(
            fieldControlClassName,
            'justify-between px-3 py-2 font-normal',
            displayLabel === placeholder && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-slot="popover-content"
        className={cn(fieldPopoverContentClassName, 'w-[var(--radix-popover-trigger-width)] p-0')}
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="max-h-60 overflow-y-auto p-1" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <ListSelectOptionButton
              key={option.value}
              label={option.label}
              selected={value === option.value}
              disabled={disabled}
              onSelect={() => selectValue(option.value)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
