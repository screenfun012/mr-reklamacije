import { m } from '@mr/i18n'
import {
  ClaimKind,
  claimCategoryFieldsForCategoryOptions,
  engineTypesReferenceOptions,
  type ClaimCategoryListItem,
  type CustomerListItem,
  type EmployeeListItem,
  type EngineManufacturerListItem,
} from '@mr/shared'
import { useQuery } from '@tanstack/react-query'

import { InternalCard } from '~/components/internal-card'

import { categoryFieldViews } from '../category-fields/category-field-model.js'
import type { ClaimCreateFormValues } from './claim-create-schemas.js'

export interface StepReviewProps {
  form: { state: { values: ClaimCreateFormValues } }
  category: ClaimCategoryListItem
  customers: readonly CustomerListItem[]
  manufacturers: readonly EngineManufacturerListItem[]
  employees: readonly EmployeeListItem[]
}

interface ReviewRow {
  label: string
  value: string
  mono?: boolean
}

const DASH = '—'

/**
 * The last step of the prototype's wizard: everything that is about to be saved, read back as
 * plain rows. Nothing is editable here — a review that can be edited is not a review, and every
 * field has a step of its own to go back to.
 *
 * The category's own answers are listed too, named in words, because they are the part a person
 * is least likely to remember typing.
 */
export function StepReview({
  form,
  category,
  customers,
  manufacturers,
  employees,
}: StepReviewProps): React.ReactElement {
  const values = form.state.values
  const isDomace = values.kind === ClaimKind.Domace

  const { data: engineTypes } = useQuery({
    ...engineTypesReferenceOptions({ manufacturerId: values.manufacturerId, activeOnly: true }),
    enabled: values.manufacturerId.length > 0,
  })
  const { data: fields } = useQuery({
    ...claimCategoryFieldsForCategoryOptions(category.id),
    enabled: category.id.length > 0,
  })

  const manufacturerName =
    manufacturers.find((item) => item.id === values.manufacturerId)?.name ?? DASH
  const engineTypeCode = engineTypes?.find((item) => item.id === values.engineTypeId)?.code ?? ''

  const rows: ReviewRow[] = [
    {
      label: m.claims_col_kind(),
      value: isDomace ? m.claims_kind_domace() : m.claims_kind_emotive(),
    },
    { label: m.field_claim_category(), value: category.name },
    { label: m.emotive_claims_col_mr_number(), value: values.mrNumber.trim() || DASH, mono: true },
    {
      label: isDomace
        ? m.domace_claims_create_field_customer_name()
        : m.emotive_claims_col_partner(),
      value: isDomace
        ? values.customerName.trim() || DASH
        : (customers.find((item) => item.id === values.customerId)?.name ?? DASH),
    },
    {
      label: m.emotive_claims_col_engine(),
      value:
        [manufacturerName === DASH ? '' : manufacturerName, engineTypeCode]
          .filter((part) => part.length > 0)
          .join(' ')
          .trim() || DASH,
      mono: true,
    },
    {
      label: m.claims_field_assigned_worker(),
      value: employees.find((item) => item.id === values.employeeId)?.fullName ?? DASH,
    },
  ]

  for (const view of categoryFieldViews(fields ?? [], values.categoryFieldValues)) {
    const raw = values.categoryFieldValues[view.code]
    const option = view.options.find((candidate) => candidate.code === raw)
    rows.push({ label: view.name, value: raw === undefined ? DASH : (option?.name ?? raw) })
  }

  rows.push({
    label: m.claim_wizard_step_faults(),
    value:
      values.faults.length === 0
        ? DASH
        : `${values.faults.length} — ${values.faults
            .map((fault) => fault.notes?.trim())
            .filter((note): note is string => note !== undefined && note.length > 0)
            .join(', ')}`,
  })

  return (
    <InternalCard className="flex flex-col gap-[3px] p-5">
      <div className="flex flex-wrap items-center gap-2.5 pb-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">
          {m.claim_wizard_review_eyebrow()}
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase text-mri-text2">
          {category.name}
        </span>
      </div>

      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-wrap items-center gap-3.5 border-b border-mri-border px-0.5 py-[9px]"
        >
          <span className="w-[190px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
            {row.label}
          </span>
          <span
            className={
              row.mono
                ? 'font-mono text-[13px] font-semibold text-mri-text'
                : 'text-[13px] font-semibold text-mri-text'
            }
          >
            {row.value}
          </span>
        </div>
      ))}

      <p className="pt-3 text-[12px] text-mri-text2">{m.claim_wizard_review_note()}</p>
    </InternalCard>
  )
}
