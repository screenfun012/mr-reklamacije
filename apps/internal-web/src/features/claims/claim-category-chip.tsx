import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

export interface ClaimCategoryChipProps {
  category: { name: string; isActive: boolean } | null
  className?: string | undefined
}

/**
 * The category as the list draws it — in the table row and in the narrow card, which must not
 * drift apart: a retired category is drawn differently (dashed, dimmed, †) because the claim
 * keeps carrying it, and that rule has to hold in both layouts.
 *
 * Data, never a fork: the name is printed, nothing reads the code to decide anything.
 */
export function ClaimCategoryChip({ category, className }: ClaimCategoryChipProps): ReactElement {
  if (category === null) {
    return <span>—</span>
  }

  return (
    <span
      title={category.name}
      className={cn(
        // Never wraps: a two-word category used to break across three lines and push every
        // row in the list from 48px to 76px (measured in the browser, 2026-08-21).
        'inline-block max-w-[170px] truncate whitespace-nowrap rounded-md border bg-mri-inbg px-2 py-[3px] font-mono text-[10px]',
        category.isActive
          ? 'border-mri-border2 text-mri-text'
          : 'border-dashed border-mri-border2 text-mri-text2',
        className,
      )}
    >
      {category.isActive ? category.name : `${category.name} †`}
    </span>
  )
}
