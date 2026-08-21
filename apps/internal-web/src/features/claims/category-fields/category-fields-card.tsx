import { m } from '@mr/i18n'
import {
  claimCategoryFieldsForCategoryOptions,
  type ClaimCategoryFieldValues,
  type ClaimPreviousCategoryFieldValues,
} from '@mr/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { InternalCard } from '~/components/internal-card'

import { categoryFieldViews } from './category-field-model'

export interface CategoryFieldsCardProps {
  categoryId: string
  categoryName: string
  values: ClaimCategoryFieldValues
  /** Kinds of work this claim was moved away from — read-only, and never lost. */
  previous?: readonly ClaimPreviousCategoryFieldValues[]
  /**
   * Live required fields with no answer; drives the amber "dopuni podatke" treatment. Defaulted
   * so a payload from a server that predates the field reads as "nothing missing" rather than
   * taking the whole claim screen down — a false alarm is the wrong way to fail here.
   */
  missing?: readonly string[]
}

function ValueRow({
  label,
  value,
  marked,
  retired = false,
}: {
  label: string
  value: string | null
  marked: boolean
  /** The office switched this question off; the answer already given is kept and said so. */
  retired?: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
        {label}
        {retired ? (
          <span className="rounded-[5px] border border-dashed border-mri-border2 bg-mri-inbg px-1.5 py-0.5 text-[7.5px] font-bold tracking-[0.1em]">
            {m.claim_category_fields_retired()}
          </span>
        ) : null}
        {marked ? (
          <span aria-hidden="true" className="size-[5px] rounded-full bg-mri-warn" />
        ) : null}
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
  previous = [],
  missing = [],
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
    <InternalCard
      data-testid="category-fields-card"
      dashed
      title={m.claim_category_fields_group()}
      meta={categoryName}
      {...(isIncomplete
        ? {
            actions: (
              <span
                title={m.claim_category_fields_incomplete_hint()}
                className="rounded-md border border-dashed border-[rgba(234,179,8,.4)] bg-mri-warn-bg px-2 py-[3px] font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-mri-warn"
              >
                ⚠ {m.claim_category_fields_incomplete()}
              </span>
            ),
          }
        : {})}
      className={isIncomplete ? 'border-[rgba(234,179,8,.4)]' : undefined}
      bodyClassName="contents"
    >
      {views.length > 0 ? (
        <div className="@container/fields px-[18px] py-4">
          <div className="grid gap-[15px_14px] @min-[420px]/fields:grid-cols-2 @min-[700px]/fields:grid-cols-3">
            {views.map((view) => {
              const raw = values[view.code]
              const option = view.options.find((candidate) => candidate.code === raw)
              const shown = raw === undefined || raw.length === 0 ? null : (option?.name ?? raw)
              return (
                <ValueRow
                  key={view.code}
                  label={view.name}
                  value={shown}
                  marked={missing.includes(view.code)}
                  retired={view.isRetired}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      {previous.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-mri-border px-[18px] py-3">
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
                  <div className="grid gap-[15px_14px] @min-[420px]/fields:grid-cols-2 @min-[700px]/fields:grid-cols-3">
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
    </InternalCard>
  )
}
