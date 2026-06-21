import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import {
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineTypesReferenceOptions,
  externalPartiesReferenceOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@mr/ui'

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

  const { data: engineTypes } = useSuspenseQuery(engineTypesReferenceOptions({ activeOnly: true }))
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
    <Card>
      <CardHeader>
        <CardTitle>{m.domace_claims_create_title()}</CardTitle>
        <p className="text-sm text-muted-foreground">{m.domace_claims_create_subtitle()}</p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="flex flex-col gap-8"
          noValidate
        >
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">{m.domace_claims_create_section_basic()}</h2>
            <DomaceBasicFields
              form={form}
              engineTypes={engineTypes}
              stepErrors={stepErrors}
              disabled={isPending}
            />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">{m.domace_claims_create_section_faults()}</h2>
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
            <div
              role="status"
              className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
            >
              <p>{m.domace_claims_create_success()}</p>
              {createdClaimId ? (
                <Link
                  to="/reklamacije/domace/$id"
                  params={{ id: createdClaimId }}
                  className="font-medium underline underline-offset-2 hover:text-emerald-800 dark:hover:text-emerald-300"
                >
                  {m.domace_claims_create_success_view()}
                </Link>
              ) : null}
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? m.domace_claims_create_saving() : m.action_save()}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
