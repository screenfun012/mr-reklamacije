import { cn } from '@mr/ui'
import { useEffect, useRef } from 'react'

/**
 * A plain native checkbox in the internal design language. No new dependency and
 * no primitive — the only non-trivial part is the header's indeterminate state,
 * which HTML exposes only as a DOM property, so it is set via a ref.
 */
export function ClaimsSelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
}): React.ReactElement {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = indeterminate && !checked
    }
  }, [indeterminate, checked])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.checked)}
      // Stop a row click (navigation) firing when you tick the box.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'size-4 flex-none cursor-pointer rounded-[4px] border border-mri-border2 bg-mri-inbg',
        'accent-mri-red',
      )}
    />
  )
}
