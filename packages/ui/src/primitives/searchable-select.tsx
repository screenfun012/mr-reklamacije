import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '../lib/cn.js'
import { fieldControlClassName, fieldPopoverContentClassName } from '../lib/field-control-styles.js'
import { Button } from './button.js'
import { Input } from './input.js'
import { ListSelectOptionButton } from './list-select-option-button.js'
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
  className?: string | undefined
}

export function filterSearchableSelectOptions(
  options: readonly SearchableSelectOption[],
  search: string,
): readonly SearchableSelectOption[] {
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
  const searchInputRef = useRef<HTMLInputElement>(null)

  const normalizedValue = value.length > 0 ? value : emptyValue

  const selectedLabel = useMemo(() => {
    if (normalizedValue === emptyValue) {
      return null
    }
    return options.find((option) => option.value === normalizedValue)?.label ?? null
  }, [emptyValue, normalizedValue, options])

  const filteredOptions = useMemo(
    () => filterSearchableSelectOptions(options, search),
    [options, search],
  )

  useEffect(() => {
    if (!open) {
      return
    }
    searchInputRef.current?.focus()
  }, [open])

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
            selectedLabel === null && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-slot="popover-content"
        className={cn(fieldPopoverContentClassName, 'w-[var(--radix-popover-trigger-width)] p-0')}
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-border p-2">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={searchPlaceholder}
            className="h-8"
            disabled={disabled}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1" role="listbox" aria-label={ariaLabel}>
          {emptyOptionLabel !== undefined ? (
            <ListSelectOptionButton
              label={emptyOptionLabel}
              selected={normalizedValue === emptyValue}
              disabled={disabled}
              onSelect={() => selectValue('')}
            />
          ) : null}
          {filteredOptions.map((option) => (
            <ListSelectOptionButton
              key={option.value}
              label={option.label}
              selected={normalizedValue === option.value}
              disabled={disabled}
              onSelect={() => selectValue(option.value)}
            />
          ))}
          {filteredOptions.length === 0 && noResultsLabel !== undefined ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{noResultsLabel}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
