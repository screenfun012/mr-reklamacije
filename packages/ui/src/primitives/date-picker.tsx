import { getLocale, type Locale } from '@mr/i18n'
import { formatListDate } from '@mr/shared'
import { CalendarIcon, X } from 'lucide-react'
import * as React from 'react'
import type { Locale as DateFnsLocale } from 'date-fns'
import { enUS, srLatn } from 'date-fns/locale'

import { fieldControlClassName } from '../lib/field-control-styles.js'
import { parseIsoDateValue, toIsoDateValue } from '../lib/date-picker-utils.js'
import { cn } from '../lib/cn.js'
import { Calendar } from './calendar.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'

const CALENDAR_LOCALES: Record<Locale, DateFnsLocale> = {
  en: enUS,
  sr: srLatn,
}

export interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD). */
  value?: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string | undefined
  disabled?: boolean | undefined
  id?: string | undefined
  className?: string | undefined
  'aria-label'?: string | undefined
}

function formatDisplayValue(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined
  }

  return formatListDate(value).replace(/\.$/, '')
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd.mm.yyyy',
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
}: DatePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const locale = getLocale()
  const selectedDate =
    value !== undefined && value.length > 0 ? parseIsoDateValue(value) : undefined
  const displayValue = formatDisplayValue(value)

  const handleSelect = (date: Date | undefined): void => {
    if (date === undefined) {
      onChange(undefined)
      return
    }

    onChange(toIsoDateValue(date))
    setOpen(false)
  }

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    onChange(undefined)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn(fieldControlClassName, 'relative gap-2 px-3 py-2', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-between gap-2 bg-transparent pr-8 text-left font-normal shadow-none',
              'focus-visible:outline-none focus-visible:ring-0',
              !displayValue && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{displayValue ?? placeholder}</span>
          </button>
        </PopoverTrigger>
        {displayValue !== undefined && disabled !== true ? (
          <button
            type="button"
            aria-label="Clear date"
            className="absolute top-1/2 right-8 -translate-y-1/2 rounded-sm opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleClear}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
        <CalendarIcon
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-60"
          aria-hidden
        />
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={CALENDAR_LOCALES[locale]}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
