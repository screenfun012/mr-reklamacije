import { Check } from 'lucide-react'

import { cn } from '../lib/cn.js'
import {
  listItemInteractiveClassName,
  listItemSelectedClassName,
} from '../lib/field-control-styles.js'

export interface ListSelectOptionButtonProps {
  label: React.ReactNode
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}

export function ListSelectOptionButton({
  label,
  selected,
  disabled = false,
  onSelect,
}: ListSelectOptionButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
        listItemInteractiveClassName,
        selected && listItemSelectedClassName,
      )}
      onPointerDown={(event) => {
        event.preventDefault()
        onSelect()
      }}
    >
      <Check
        className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </button>
  )
}
