import {
  ApiError,
  assignedWorkerReferenceOptions,
  engineManufacturersReferenceOptions,
  formatFieldError,
  type ClientSubmissionDetail,
  type EngineManufacturerListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { DatePicker, Input, SearchableSelect } from '@mr/ui'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { InternalFieldGroup } from '~/components/internal-field-group'
import { InternalFieldLabel } from '~/components/internal-field'
import { InternalNote } from '~/components/internal-note'
import { EmployeeSelectField } from '~/features/claims/employee-select-field'
import { EngineTypeSearchableSelectField } from '~/features/claims/engine-type-searchable-select-field'
import {
  EMOTIVE_CLAIM_FORM_DEFAULTS,
  emotiveClaimStepBasicSchema,
  formatZodFieldErrors,
  formValuesToCreateInput,
} from '~/features/emotive-claims/create/emotive-claim-create-schemas'
import {
  FORM_CONTROL_CLASS,
  TEXTAREA_FIELD_CLASS,
} from '~/features/emotive-claims/create/form-field-styles'

import { useConvertSubmission } from './use-convert-submission'

function manufacturerOptions(
  manufacturers: readonly EngineManufacturerListItem[],
): { value: string; label: string; keywords: string }[] {
  return manufacturers.map((manufacturer) => ({
    value: manufacturer.id,
    label: manufacturer.name,
    keywords: manufacturer.code,
  }))
}

export interface ConvertClaimFormProps {
  submission: ClientSubmissionDetail
  onCancel: () => void
}

/**
 * Focused EMOTIVE-claim form pre-filled from a client submission: the firm is fixed
 * (read-only display) and Razlog (`warrantyReport`) is seeded from the client's message.
 * Submitting POSTs to the convert endpoint (create + attachment carry-over + status flip
 * are one server-side transaction). Reuses the emotive create FIELD components + schema.
 */
export function ConvertClaimForm({
  submission,
  onCancel,
}: ConvertClaimFormProps): React.ReactElement {
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  const { data: employees } = useSuspenseQuery(assignedWorkerReferenceOptions())

  const convertMutation = useConvertSubmission(submission.id)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      ...EMOTIVE_CLAIM_FORM_DEFAULTS,
      customerId: submission.customerId,
      warrantyReport: submission.message,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await convertMutation.mutateAsync(formValuesToCreateInput(value))
      } catch (error) {
        setSubmitError(error instanceof ApiError ? error.message : m.internal_inbox_convert_error())
      }
    },
  })

  const isPending = convertMutation.isPending

  const handleSubmit = (): void => {
    const result = emotiveClaimStepBasicSchema.safeParse(form.state.values)
    if (!result.success) {
      setFieldErrors(formatZodFieldErrors(result.error))
      return
    }
    setFieldErrors({})
    void form.handleSubmit()
  }

  return (
    <InternalCard className="p-6 sm:p-7">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        className="flex flex-col gap-6"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-[7px] sm:col-span-2">
            <InternalFieldLabel>{m.internal_inbox_convert_customer()}</InternalFieldLabel>
            <div className="flex h-11 items-center rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-sm font-semibold text-mri-text">
              {submission.customerName}
            </div>
          </div>

          <form.Field
            name="mrNumber"
            children={(field) => (
              <InternalFieldGroup
                id="mrNumber"
                label={m.emotive_claims_create_field_mr_number()}
                required
                error={fieldErrors['mrNumber'] ?? formatFieldError(field.state.meta.errors[0])}
              >
                <Input
                  id="mrNumber"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  disabled={isPending}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Field
            name="claimNumber"
            children={(field) => (
              <InternalFieldGroup
                id="claimNumber"
                label={m.emotive_claims_create_field_claim_number()}
              >
                <Input
                  id="claimNumber"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  disabled={isPending}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Field
            name="manufacturerId"
            children={(field) => (
              <InternalFieldGroup
                id="manufacturerId"
                label={m.emotive_claims_create_field_manufacturer()}
                error={
                  fieldErrors['manufacturerId'] ?? formatFieldError(field.state.meta.errors[0])
                }
              >
                <SearchableSelect
                  id="manufacturerId"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value}
                  options={manufacturerOptions(manufacturers)}
                  placeholder={m.emotive_claims_create_select_placeholder()}
                  searchPlaceholder={m.field_search_placeholder()}
                  emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
                  noResultsLabel={m.field_no_results()}
                  disabled={isPending}
                  aria-label={m.emotive_claims_create_field_manufacturer()}
                  onValueChange={(nextValue) => {
                    field.handleChange(nextValue)
                    form.setFieldValue('engineTypeId', '')
                  }}
                  onBlur={field.handleBlur}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Subscribe selector={(state) => state.values.manufacturerId}>
            {(manufacturerId) => (
              <form.Field
                name="engineTypeId"
                children={(field) => (
                  <InternalFieldGroup
                    id="engineTypeId"
                    label={m.emotive_claims_create_field_engine_type()}
                    required
                    error={
                      fieldErrors['engineTypeId'] ?? formatFieldError(field.state.meta.errors[0])
                    }
                  >
                    <EngineTypeSearchableSelectField
                      id="engineTypeId"
                      className={FORM_CONTROL_CLASS}
                      value={field.state.value}
                      manufacturerId={manufacturerId}
                      disabled={isPending}
                      aria-label={m.emotive_claims_create_field_engine_type()}
                      onValueChange={field.handleChange}
                      onBlur={field.handleBlur}
                    />
                  </InternalFieldGroup>
                )}
              />
            )}
          </form.Subscribe>

          <form.Field
            name="engineCode"
            children={(field) => (
              <InternalFieldGroup
                id="engineCode"
                label={m.emotive_claims_create_field_engine_code()}
              >
                <Input
                  id="engineCode"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  disabled={isPending}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Field
            name="employeeId"
            children={(field) => (
              <InternalFieldGroup id="employeeId" label={m.claims_field_assigned_worker()}>
                <EmployeeSelectField
                  id="employeeId"
                  value={field.state.value}
                  employees={employees}
                  disabled={isPending}
                  aria-label={m.claims_field_assigned_worker()}
                  onValueChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Field
            name="dateOfFinish"
            children={(field) => (
              <InternalFieldGroup
                id="dateOfFinish"
                label={m.emotive_claims_create_field_date_finish()}
                error={fieldErrors['dateOfFinish'] ?? formatFieldError(field.state.meta.errors[0])}
              >
                <DatePicker
                  id="dateOfFinish"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value.length > 0 ? field.state.value : undefined}
                  onChange={(value) => field.handleChange(value ?? '')}
                  disabled={isPending}
                  aria-label={m.emotive_claims_create_field_date_finish()}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Field
            name="dateOfClaim"
            children={(field) => (
              <InternalFieldGroup
                id="dateOfClaim"
                label={m.emotive_claims_create_field_date_claim()}
                required
                error={fieldErrors['dateOfClaim'] ?? formatFieldError(field.state.meta.errors[0])}
              >
                <DatePicker
                  id="dateOfClaim"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value.length > 0 ? field.state.value : undefined}
                  onChange={(value) => field.handleChange(value ?? '')}
                  disabled={isPending}
                  aria-label={m.emotive_claims_create_field_date_claim()}
                />
              </InternalFieldGroup>
            )}
          />

          <form.Field
            name="warrantyReport"
            children={(field) => (
              <InternalFieldGroup
                id="warrantyReport"
                label={m.emotive_claims_create_field_warranty_report()}
                className="sm:col-span-2"
                error={
                  fieldErrors['warrantyReport'] ?? formatFieldError(field.state.meta.errors[0])
                }
              >
                <textarea
                  id="warrantyReport"
                  className={TEXTAREA_FIELD_CLASS}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  disabled={isPending}
                />
              </InternalFieldGroup>
            )}
          />
        </div>

        {submitError ? (
          <InternalNote tone="error" role="alert">
            {submitError}
          </InternalNote>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <InternalButton
            type="button"
            variant="outline"
            className="h-[46px] w-auto px-6 text-[12.5px]"
            disabled={isPending}
            onClick={onCancel}
          >
            {m.action_cancel()}
          </InternalButton>
          <InternalButton
            type="button"
            variant="green"
            className="h-[46px] w-auto px-6 text-[12.5px]"
            disabled={isPending}
            onClick={handleSubmit}
          >
            <Check className="size-4" aria-hidden="true" /> {m.action_save()}
          </InternalButton>
        </div>
      </form>
    </InternalCard>
  )
}
