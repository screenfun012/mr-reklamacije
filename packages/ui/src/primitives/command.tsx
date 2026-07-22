import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import * as React from 'react'

import { cn } from '../lib/cn.js'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog.js'

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md bg-background text-foreground',
      className,
    )}
    {...props}
  />
))
Command.displayName = 'Command'

const DEFAULT_COMMAND_CHROME =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3'

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title: string
  description?: string
  /** Backdrop styling. */
  overlayClassName?: string
  /** Panel styling — position, size and surface. */
  contentClassName?: string
  /**
   * Replaces the default shadcn chrome on the inner `Command` root. Pass this
   * when the app skins the palette itself; omit it to keep the neutral look.
   */
  commandClassName?: string
  /** Drops the dialog's default centering/surface so the panel can be positioned freely. */
  unstyled?: boolean
}

function CommandDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  overlayClassName,
  contentClassName,
  commandClassName,
  unstyled = false,
}: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        wide
        hideClose
        unstyled={unstyled}
        overlayClassName={overlayClassName}
        className={cn(
          'overflow-hidden',
          !unstyled && 'sm:max-w-[560px]',
          unstyled && 'flex flex-col gap-0 p-0',
          contentClassName,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description !== undefined ? (
          <DialogDescription className="sr-only">{description}</DialogDescription>
        ) : null}
        <Command
          className={cn(commandClassName === undefined ? DEFAULT_COMMAND_CHROME : commandClassName)}
          shouldFilter={false}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
    /** Styles the row around the icon and the input. */
    wrapperClassName?: string
    /** Replaces the default search icon (e.g. a differently sized/coloured one). */
    icon?: React.ReactNode
  }
>(({ className, wrapperClassName, icon, ...props }, ref) => (
  <div className={cn('flex items-center border-b px-3', wrapperClassName)} cmdk-input-wrapper="">
    {icon ?? <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />}
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = 'CommandInput'

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[360px] overflow-y-auto overflow-x-hidden', className)}
    {...props}
  />
))
CommandList.displayName = 'CommandList'

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-muted-foreground"
    {...props}
  />
))
CommandEmpty.displayName = 'CommandEmpty'

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn('overflow-hidden p-1 text-foreground', className)}
    {...props}
  />
))
CommandGroup.displayName = 'CommandGroup'

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className,
    )}
    {...props}
  />
))
CommandItem.displayName = 'CommandItem'

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 h-px bg-border', className)}
    {...props}
  />
))
CommandSeparator.displayName = 'CommandSeparator'

export {
  Command,
  CommandDialog,
  type CommandDialogProps,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
}
