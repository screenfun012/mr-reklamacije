import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { DayPicker, type DayPickerProps } from 'react-day-picker'

import { cn } from '../lib/cn.js'
import { buttonVariants } from './button-variants.js'

export type CalendarProps = DayPickerProps

const navButtonClassName = cn(
  buttonVariants({ variant: 'outline' }),
  'size-7 shrink-0 p-0 opacity-60 hover:opacity-100',
)

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  navLayout = 'around',
  ...props
}: CalendarProps): React.ReactElement {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4 sm:flex-row',
        month: 'grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-x-1 gap-y-3',
        month_caption: 'col-start-2 row-start-1 flex items-center justify-center',
        caption_label: 'text-sm font-medium capitalize',
        button_previous: cn(navButtonClassName, 'col-start-1 row-start-1'),
        button_next: cn(navButtonClassName, 'col-start-3 row-start-1'),
        month_grid: 'col-span-3 row-start-2 w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-2 flex w-full',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:rounded-md [&:has([aria-selected])]:bg-accent',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          'rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'rounded-md bg-[var(--mr-calendar-today)] font-medium text-foreground',
        outside:
          'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
          return <Icon className={cn('size-4', chevronClassName)} {...chevronProps} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
