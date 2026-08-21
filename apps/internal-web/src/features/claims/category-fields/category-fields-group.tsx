import { m } from '@mr/i18n'
import {
  CLAIM_CATEGORY_FIELD_TEXT_MAX_LENGTH,
  claimCategoryFieldsForCategoryOptions,
  type ClaimCategoryFieldValues,
} from '@mr/shared'
import { cn, SearchableSelect } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'

import { categoryFieldViews, type CategoryFieldView } from './category-field-model'

export interface CategoryFieldsGroupProps {
  categoryId: string
  categoryName: string
  values: ClaimCategoryFieldValues
  onChange: (values: ClaimCategoryFieldValues) => void
  disabled?: boolean
}

function SegmentedField({
  field,
  value,
  onPick,
  disabled,
}: {
  field: CategoryFieldView
  value: string | undefined
  onPick: (next: string) => void
  disabled: boolean
}): React.ReactElement {
  return (
    // A plain group, not a <label>: a <button> inside a label takes the label's whole text as
    // its accessible name, so every segment would announce as "Obrađeni deo * Glava Blok".
    <span role="group" aria-label={field.name} className="flex gap-[7px]">
      {field.options.map((option) => {
        const selected = option.code === value
        return (
          <button
            key={option.code}
            type="button"
            // A retired option can be shown as the chosen one but never picked afresh — the
            // server refuses it either way; this only keeps the screen from offering it.
            disabled={disabled || (!option.isActive && !selected)}
            onClick={() => onPick(selected ? '' : option.code)}
            aria-pressed={selected}
            className={cn(
              'inline-flex h-[38px] cursor-pointer items-center rounded-lg px-[14px] text-[12.5px] transition-colors',
              selected
                ? 'border border-[rgba(237,28,36,.5)] bg-[rgba(237,28,36,.13)] font-bold text-mri-text'
                : 'border border-mri-border2 font-semibold text-mri-text2 hover:border-mri-text2',
              !option.isActive && 'border-dashed',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {option.isActive ? option.name : `${option.name} †`}
          </button>
        )
      })}
    </span>
  )
}

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CategoryFieldView
  value: string | undefined
  onChange: (next: string) => void
  disabled: boolean
}): React.ReactElement {
  if (field.control === 'text') {
    return (
      <input
        type="text"
        value={value ?? ''}
        maxLength={CLAIM_CATEGORY_FIELD_TEXT_MAX_LENGTH}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={field.name}
        className="mri-input h-[38px] rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-[13px] font-medium text-mri-text outline-none focus:border-mri-red focus:shadow-[0_0_0_3px_rgba(237,28,36,.18)] disabled:opacity-60"
      />
    )
  }

  if (field.control === 'dropdown') {
    return (
      <SearchableSelect
        value={value ?? ''}
        options={field.options.map((option) => ({
          value: option.code,
          label: option.isActive ? option.name : `${option.name} †`,
        }))}
        onValueChange={onChange}
        disabled={disabled}
        aria-label={field.name}
        emptyOptionLabel={m.field_not_selected()}
      />
    )
  }

  return <SegmentedField field={field} value={value} onPick={onChange} disabled={disabled} />
}

/**
 * The group of questions one kind of work asks — the dashed block in the prototype
 * (`kategorije-prototip.dc.html`, wizard step "Osnovni podaci").
 *
 * It is fed by the CATALOGUE, not by a list written in code: adding "glava, deklo, karter" is a
 * row in the admin panel. A category that asks nothing renders nothing at all — not an empty
 * box, which would read as something being broken.
 *
 * Deliberately not Suspense: the fields are an addition to a form that must keep working. A slow
 * or failed catalogue read leaves the rest of the claim editable rather than blanking the step.
 */
export function CategoryFieldsGroup({
  categoryId,
  categoryName,
  values,
  onChange,
  disabled = false,
}: CategoryFieldsGroupProps): React.ReactElement | null {
  const { data: fields } = useQuery({
    ...claimCategoryFieldsForCategoryOptions(categoryId),
    enabled: categoryId.length > 0,
  })

  const views = categoryFieldViews(fields ?? [], values)
  if (views.length === 0) {
    return null
  }

  function setValue(code: string, next: string): void {
    const trimmed = next.trim()
    const rest = Object.fromEntries(Object.entries(values).filter(([key]) => key !== code))
    onChange(trimmed.length === 0 ? rest : { ...rest, [code]: trimmed })
  }

  return (
    <div
      data-testid="category-fields-group"
      className="@container/catfields flex flex-col gap-[11px] rounded-xl border border-dashed border-mri-border2 p-[15px]"
    >
      <div className="flex items-center gap-[9px]">
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-mri-text2">
          {m.claim_category_fields_group()} ·{' '}
          <span className="text-mri-text">{categoryName.toUpperCase()}</span>
        </span>
      </div>

      <div className="grid gap-[11px_16px] @min-[520px]/catfields:grid-cols-2">
        {views.map((field) => (
          <div key={field.code} className="flex flex-col gap-[5px]">
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
              {field.name}
              {field.isRequired ? <span className="text-mri-redh"> *</span> : null}
              {field.isRetired ? (
                <span className="ml-1.5 rounded border border-dashed border-mri-border2 px-1.5 py-px text-[8.5px] text-mri-text2">
                  {m.claim_category_fields_retired()}
                </span>
              ) : null}
            </span>
            <FieldControl
              field={field}
              value={values[field.code]}
              onChange={(next) => setValue(field.code, next)}
              // A field the office has switched off is history: shown so the answer is not lost,
              // never editable, because a new answer to a retired question makes no sense.
              disabled={disabled || field.isRetired}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
