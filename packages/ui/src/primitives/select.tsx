import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '../lib/cn.js'
import { fieldControlClassName, fieldPopoverContentClassName } from '../lib/field-control-styles.js'
import { Button } from './button.js'
import { ListSelectOptionButton } from './list-select-option-button.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'

interface ParsedSelectStructure {
  triggerProps: {
    id?: string | undefined
    className?: string | undefined
    'aria-label'?: string | undefined
    onBlur?: React.FocusEventHandler<HTMLButtonElement> | undefined
    children?: React.ReactNode | undefined
  }
  placeholder: string
  items: { value: string; label: React.ReactNode }[]
  contentClassName?: string | undefined
}

interface SelectTriggerElementProps {
  className?: string | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  onBlur?: React.FocusEventHandler<HTMLButtonElement> | undefined
  children?: React.ReactNode | undefined
}

interface SelectValueElementProps {
  placeholder?: string | undefined
}

interface SelectContentElementProps {
  children?: React.ReactNode | undefined
  className?: string | undefined
}

interface SelectItemElementProps {
  value: string
  children?: React.ReactNode | undefined
}

function isElementOfType<P>(
  child: React.ReactNode,
  displayName: string,
): child is React.ReactElement<P> {
  return (
    React.isValidElement(child) &&
    typeof child.type !== 'string' &&
    (child.type as { displayName?: string }).displayName === displayName
  )
}

function parseSelectChildren(children: React.ReactNode): ParsedSelectStructure {
  let triggerProps: ParsedSelectStructure['triggerProps'] = {}
  let placeholder = ''
  const items: { value: string; label: React.ReactNode }[] = []
  let contentClassName: string | undefined

  React.Children.forEach(children, (child) => {
    if (isElementOfType<SelectTriggerElementProps>(child, 'SelectTrigger')) {
      const {
        className,
        id,
        'aria-label': ariaLabel,
        onBlur,
        children: triggerChildren,
      } = child.props
      triggerProps = {
        ...(id !== undefined ? { id } : {}),
        ...(className !== undefined ? { className } : {}),
        ...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {}),
        ...(onBlur !== undefined ? { onBlur } : {}),
        children: triggerChildren,
      }

      React.Children.forEach(triggerChildren, (triggerChild) => {
        if (isElementOfType<SelectValueElementProps>(triggerChild, 'SelectValue')) {
          placeholder = triggerChild.props.placeholder ?? ''
        }
      })
    }

    if (isElementOfType<SelectContentElementProps>(child, 'SelectContent')) {
      contentClassName = child.props.className
      React.Children.forEach(child.props.children, (itemChild) => {
        if (isElementOfType<SelectItemElementProps>(itemChild, 'SelectItem')) {
          items.push({
            value: itemChild.props.value,
            label: itemChild.props.children,
          })
        }
      })
    }
  })

  return { triggerProps, placeholder, items, contentClassName }
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Select({
  value,
  onValueChange,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: SelectProps): React.ReactElement {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen

  const { triggerProps, placeholder, items, contentClassName } = useMemo(
    () => parseSelectChildren(children),
    [children],
  )

  const selectedLabel = useMemo(() => {
    const match = items.find((item) => item.value === value)
    return match?.label ?? null
  }, [items, value])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  const selectValue = (nextValue: string): void => {
    onValueChange(nextValue)
    handleOpenChange(false)
  }

  const triggerLabel =
    triggerProps.children !== undefined &&
    !React.Children.toArray(triggerProps.children).some((child) =>
      isElementOfType(child, 'SelectValue'),
    )
      ? triggerProps.children
      : (selectedLabel ?? placeholder)

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          id={triggerProps.id}
          aria-label={triggerProps['aria-label']}
          onBlur={triggerProps.onBlur}
          className={cn(
            fieldControlClassName,
            'justify-between gap-2 px-3 py-2 font-normal [&>span]:line-clamp-1',
            selectedLabel === null && placeholder !== '' && 'text-muted-foreground',
            triggerProps.className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-slot="popover-content"
        className={cn(
          fieldPopoverContentClassName,
          'w-[var(--radix-popover-trigger-width)] p-0',
          contentClassName,
        )}
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div
          className="max-h-60 overflow-y-auto p-1"
          role="listbox"
          aria-label={triggerProps['aria-label']}
        >
          {items.map((item) => (
            <ListSelectOptionButton
              key={item.value}
              label={item.label}
              selected={value === item.value}
              disabled={disabled}
              onSelect={() => selectValue(item.value)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
Select.displayName = 'Select'

function SelectGroup(props: { children: React.ReactNode }): null {
  void props
  return null
}
SelectGroup.displayName = 'SelectGroup'

interface SelectValueProps {
  placeholder?: string
}

function SelectValue(props: SelectValueProps): null {
  void props
  return null
}
SelectValue.displayName = 'SelectValue'

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

function SelectTrigger(props: SelectTriggerProps): null {
  void props
  return null
}
SelectTrigger.displayName = 'SelectTrigger'

interface SelectContentProps {
  children?: React.ReactNode
  className?: string
}

function SelectContent(props: SelectContentProps): null {
  void props
  return null
}
SelectContent.displayName = 'SelectContent'

function SelectLabel(props: { children: React.ReactNode; className?: string }): null {
  void props
  return null
}
SelectLabel.displayName = 'SelectLabel'

interface SelectItemProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

function SelectItem(props: SelectItemProps): null {
  void props
  return null
}
SelectItem.displayName = 'SelectItem'

function SelectSeparator(props: { className?: string }): null {
  void props
  return null
}
SelectSeparator.displayName = 'SelectSeparator'

function SelectScrollUpButton(props: { className?: string }): null {
  void props
  return null
}
SelectScrollUpButton.displayName = 'SelectScrollUpButton'

function SelectScrollDownButton(props: { className?: string }): null {
  void props
  return null
}
SelectScrollDownButton.displayName = 'SelectScrollDownButton'

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
