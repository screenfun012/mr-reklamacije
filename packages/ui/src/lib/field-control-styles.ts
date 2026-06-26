import { cn } from './cn.js'

/** Shared trigger/control chrome for Select, DatePicker, and future field primitives. */
export const fieldControlClassName = cn(
  'flex h-9 w-full items-center rounded-md border border-input bg-background text-sm shadow-sm transition-colors',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

export const fieldPopoverContentClassName = cn(
  'z-[100] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
)
