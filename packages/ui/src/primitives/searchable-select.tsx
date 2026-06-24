import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '../lib/cn.js'
import { fieldControlClassName, fieldPopoverContentClassName } from '../lib/field-control-styles.js'
import { Button } from './button.js'
import { Input } from './input.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'

export const SEARCHABLE_SELECT_EMPTY_VALUE = '__empty__'

export interface SearchableSelectOption {
  value: string
  label: string
  keywords?: string
}

export interface SearchableSelectProps {
  id?: string
  value: string
  options: readonly SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyOptionLabel?: string
  emptyValue?: string
  noResultsLabel?: string
  disabled?: boolean
  onValueChange: (value: string) => void
  onBlur?: () => void
  'aria-label'?: string
  className?: string
}

export function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyOptionLabel,
  emptyValue = SEARCHABLE_SELECT_EMPTY_VALUE,
  noResultsLabel,
  disabled = false,
  onValueChange,
  onBlur,
  'aria-label': ariaLabel,
  className,
}: SearchableSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const normalizedValue = value.length > 0 ? value : emptyValue

  const selectedLabel = useMemo(() => {
    if (normalizedValue === emptyValue) {
      return null
    }
    return options.find((option) => option.value === normalizedValue)?.label ?? null
  }, [emptyValue, normalizedValue, options])

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (query === '') {
      return options
    }

    return options.filter((option) => {
      if (option.label.toLowerCase().includes(query)) {
        return true
      }
      if (option.value.toLowerCase().includes(query)) {
        return true
      }
      return option.keywords?.toLowerCase().includes(query) ?? false
    })
  }, [options, search])

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearch('')
      onBlur?.()
    }
  }

  const selectValue = (nextValue: string): void => {
    onValueChange(nextValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
            'justify-between px-3 py-2 font-normal hover:bg-background',
            selectedLabel === null && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(fieldPopoverContentClassName, 'w-[var(--radix-popover-trigger-width)] p-0')}
        align="start"
      >
        <div className="border-b border-border p-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8"
            disabled={disabled}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {emptyOptionLabel !== undefined ? (
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                normalizedValue === emptyValue && 'bg-accent text-accent-foreground',
              )}
              onClick={() => selectValue('')}
            >
              <Check
                className={cn(
                  'size-4 shrink-0',
                  normalizedValue === emptyValue ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              <span>{emptyOptionLabel}</span>
            </button>
          ) : null}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                normalizedValue === option.value && 'bg-accent text-accent-foreground',
              )}
              onClick={() => selectValue(option.value)}
            >
              <Check
                className={cn(
                  'size-4 shrink-0',
                  normalizedValue === option.value ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              <span className="truncate">{option.label}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && noResultsLabel !== undefined ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{noResultsLabel}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
