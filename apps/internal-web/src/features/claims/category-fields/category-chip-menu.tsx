import { m } from '@mr/i18n'
import { type ClaimCategoryListItem } from '@mr/shared'
import { cn, Popover, PopoverContent, PopoverTrigger } from '@mr/ui'
import { useState } from 'react'

export interface CategoryChipMenuProps {
  /** Every LIVE category, in catalogue order — plus the current one even if it is retired. */
  categories: readonly ClaimCategoryListItem[]
  categoryId: string
  categoryName: string
  onPick: (next: ClaimCategoryListItem) => void
  disabled?: boolean
}

/**
 * `KATEGORIJA: MAŠINSKA OBRADA ▾` — the prototype's chip, in the wizard header and beside the MR
 * number on the detail. Values read from `kategorije-prototip.dc.html` (wizard header block).
 *
 * The chip only REPORTS a pick. What it costs is the caller's business, and the two callers
 * differ: in the wizard a change discards what was typed (after a confirmation), on a saved
 * claim it is a change that keeps the old answers and marks the claim.
 */
export function CategoryChipMenu({
  categories,
  categoryId,
  categoryName,
  onPick,
  disabled = false,
}: CategoryChipMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false)

  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-mri-border2 bg-mri-inbg px-[13px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mri-text2">
        {m.field_claim_category()}: <span className="text-mri-text">{categoryName}</span>
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={m.field_claim_category()}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-mri-border2 bg-mri-inbg px-[13px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mri-text2 transition-colors hover:border-mri-text2"
        >
          {m.field_claim_category()}: <span className="text-mri-text">{categoryName}</span>
          <span aria-hidden="true" className="text-[9px]">
            ▾
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[196px] rounded-xl border-mri-border2 bg-mri-raised p-1.5 shadow-[0_18px_44px_rgba(0,0,0,.55)]"
      >
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              setOpen(false)
              if (category.id !== categoryId) {
                onPick(category)
              }
            }}
            aria-current={category.id === categoryId ? 'true' : undefined}
            className={cn(
              'flex h-[31px] w-full cursor-pointer items-center rounded-lg px-[9px] text-left text-[12.5px] transition-colors hover:bg-mri-rowhv',
              category.id === categoryId
                ? 'bg-[rgba(237,28,36,.11)] font-bold text-mri-text'
                : 'font-semibold text-mri-text2',
            )}
          >
            {category.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
