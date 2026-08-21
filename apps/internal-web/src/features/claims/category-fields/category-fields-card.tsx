import { m } from '@mr/i18n'
import {
  claimCategoryFieldsForCategoryOptions,
  type ClaimCategoryFieldValues,
  type ClaimPreviousCategoryFieldValues,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { categoryFieldViews } from './category-field-model'

export interface CategoryFieldsCardProps {
  categoryId: string
  categoryName: string
  values: ClaimCategoryFieldValues
  /** Kinds of work this claim was moved away from — read-only, and never lost. */
  previous: readonly ClaimPreviousCategoryFieldValues[]
  /** Live required fields with no answer; drives the amber "dopuni podatke" treatment. */
  missing: readonly string[]
}

function ValueRow({
  label,
  value,
  marked,
}: {
  label: string
  value: string | null
  marked: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
        {label}
        {marked ? <span aria-hidden="true" className="size-[5px] rounded-full bg-mri-amb" /> : null}
      </span>
      {value === null ? (
        <span className="text-[13px] italic text-mri-text2">{m.claim_category_fields_empty()}</span>
      ) : (
        <span className="text-[13px] font-semibold text-mri-text">{value}</span>
      )}
    </div>
  )
}

/**
 * What one claim answered for its kind of work, read-only (prototype §9, plus the two 21.08.
 * handoffs). Three states per field: answered, "Nije popunjeno", and a retired field whose
 * answer is kept anyway.
 *
 * The amber treatment is not a stored flag — `missing` is computed by the server from the
 * catalogue on every read, so a field the office marks required today marks yesterday's claims
 * without anybody running anything.
 *
 * Renders nothing when the category asks nothing AND the claim carries no history: an empty card
 * reads as something being broken.
 */
export function CategoryFieldsCard({
  categoryId,
  categoryName,
  values,
  previous,
  missing,
}: CategoryFieldsCardProps): React.ReactElement | null {
  const { data: fields } = useQuery({
    ...claimCategoryFieldsForCategoryOptions(categoryId),
    enabled: categoryId.length > 0,
  })
  const [showPrevious, setShowPrevious] = useState(false)

  const views = categoryFieldViews(fields ?? [], values)
  if (views.length === 0 && previous.length === 0) {
    return null
  }

  const isIncomplete = missing.length > 0

  return (
    <div
      data-testid="category-fields-card"
      className={cn(
        'flex flex-col gap-3 rounded-[14px] border bg-mri-surface p-[15px]',
        isIncomplete ? 'border-dashed border-[rgba(234,179,8,.4)]' : 'border-mri-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-[9px]">
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-mri-text2">
          {m.claim_category_fields_group()} ·{' '}
          <span className="text-mri-text">{categoryName.toUpperCase()}</span>
        </span>
        {isIncomplete ? (
          <span
            title={m.claim_category_fields_incomplete_hint()}
            className="rounded-md border border-dashed border-[rgba(234,179,8,.4)] bg-[rgba(234,179,8,.1)] px-2 py-[3px] font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-mri-amb"
          >
            ⚠ {m.claim_category_fields_incomplete()}
          </span>
        ) : null}
      </div>

      {views.length > 0 ? (
        <div className="grid gap-[11px_16px] sm:grid-cols-2">
          {views.map((view) => {
            const raw = values[view.code]
            const option = view.options.find((candidate) => candidate.code === raw)
            const shown = raw === undefined || raw.length === 0 ? null : (option?.name ?? raw)
            return (
              <ValueRow
                key={view.code}
                label={view.isRetired ? `${view.name} †` : view.name}
                value={shown}
                marked={missing.includes(view.code)}
              />
            )
          })}
        </div>
      ) : null}

      {previous.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-mri-border pt-3">
          <button
            type="button"
            onClick={() => setShowPrevious(!showPrevious)}
            aria-expanded={showPrevious}
            className="flex cursor-pointer items-center gap-2 self-start font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2 transition-colors hover:text-mri-text"
          >
            {m.claim_category_fields_previous()}
            <span aria-hidden="true">{showPrevious ? '▾' : '▸'}</span>
          </button>

          {showPrevious
            ? previous.map((section) => (
                <div key={section.categoryCode} className="flex flex-col gap-2 opacity-70">
                  <span className="flex items-center gap-2 font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
                    {section.categoryName}
                    <span className="rounded border border-dashed border-mri-border2 px-1.5 py-px text-[8px]">
                      {m.claim_category_fields_previous_badge()}
                    </span>
                  </span>
                  <div className="grid gap-[11px_16px] sm:grid-cols-2">
                    {section.values.map((value) => (
                      <ValueRow
                        key={value.fieldCode}
                        label={value.fieldName}
                        value={value.display}
                        marked={false}
                      />
                    ))}
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  )
}
