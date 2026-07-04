import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  externalPartiesReferenceOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { InternalNote } from '~/components/internal-note'

import { StepFaultsFields } from '../../emotive-claims/create/step-faults-fields.js'
import { DomaceBasicFields } from './domace-basic-fields.js'
import {
  DOMACE_CLAIM_FORM_DEFAULTS,
  domaceClaimFormSchema,
  formatZodFieldErrors,
  formValuesToCreateInput,
  validateFaultDrafts,
  type DomaceClaimFormValues,
} from './domace-claim-create-schemas.js'
import { createDomaceClaimErrorMessage, useCreateDomaceClaim } from './use-create-domace-claim.js'

export function DomaceClaimCreateForm(): React.ReactElement {
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null)

  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions({ activeOnly: true }))
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions({ activeOnly: true }))
  const { data: externalParties } = useSuspenseQuery(
    externalPartiesReferenceOptions({ activeOnly: true }),
  )

  const createMutation = useCreateDomaceClaim()
  const isPending = createMutation.isPending

  const form = useForm({
    defaultValues: DOMACE_CLAIM_FORM_DEFAULTS,
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setShowSuccess(false)
      setCreatedClaimId(null)
      if (!validate(value)) {
        return
      }
      try {
        const input = formValuesToCreateInput(value)
        const created = await createMutation.mutateAsync(input)
        form.reset()
        setStepErrors({})
        setCreatedClaimId(created.id)
        setShowSuccess(true)
      } catch (error) {
        setSubmitError(createDomaceClaimErrorMessage(error))
      }
    },
  })

  const validate = (values: DomaceClaimFormValues): boolean => {
    const errors: Record<string, string> = {}

    const basicResult = domaceClaimFormSchema.safeParse(values)
    if (!basicResult.success) {
      Object.assign(errors, formatZodFieldErrors(basicResult.error))
    }

    if (values.faults.length > 0) {
      const faultError = validateFaultDrafts(values.faults)
      if (faultError) {
        Object.assign(errors, formatZodFieldErrors(faultError))
      }
    }

    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  return (
    <InternalCard className="mri-fade-up p-6 sm:p-7" style={{ animationDelay: '0.1s' }}>
      <p className="mb-6 text-sm text-mri-text2">{m.domace_claims_create_subtitle()}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        className="flex flex-col gap-8"
        noValidate
      >
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
            {m.domace_claims_create_section_basic()}
          </h2>
          <DomaceBasicFields
            form={form}
            manufacturers={manufacturers}
            stepErrors={stepErrors}
            disabled={isPending}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
            {m.domace_claims_create_section_faults()}
          </h2>
          <StepFaultsFields
            form={form}
            departments={departments}
            employees={employees}
            externalParties={externalParties}
            stepErrors={stepErrors}
            disabled={isPending}
          />
        </section>

        {showSuccess ? (
          <InternalNote tone="info" role="status">
            <span className="flex flex-col gap-1">
              <span>{m.domace_claims_create_success()}</span>
              {createdClaimId ? (
                <Link
                  to="/reklamacije/domace/$id"
                  params={{ id: createdClaimId }}
                  search={CLAIM_DETAIL_DEFAULT_SEARCH}
                  className="font-semibold text-mri-redh hover:underline"
                >
                  {m.domace_claims_create_success_view()}
                </Link>
              ) : null}
            </span>
          </InternalNote>
        ) : null}

        {submitError ? (
          <InternalNote tone="error" role="alert">
            {submitError}
          </InternalNote>
        ) : null}

        <div className="flex justify-end">
          <InternalButton
            type="submit"
            variant="green"
            className="h-[46px] w-auto px-6 text-[12.5px]"
            disabled={isPending}
          >
            <span aria-hidden="true" className="font-normal">
              ✓
            </span>{' '}
            {m.action_save()}
          </InternalButton>
        </div>
      </form>
    </InternalCard>
  )
}
