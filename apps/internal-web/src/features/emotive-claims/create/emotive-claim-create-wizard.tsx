import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  CustomerKind,
  customersReferenceOptions,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineTypesReferenceOptions,
  externalPartiesReferenceOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@mr/ui'

import {
  EMOTIVE_CLAIM_FORM_DEFAULTS,
  emotiveClaimStepBasicSchema,
  formatZodFieldErrors,
  formValuesToCreateInput,
  validateFaultDrafts,
  type EmotiveClaimFormValues,
} from './emotive-claim-create-schemas.js'
import { StepBasicFields } from './step-basic-fields.js'
import { StepFaultsFields } from './step-faults-fields.js'
import { StepReview } from './step-review.js'
import {
  createEmotiveClaimErrorMessage,
  useCreateEmotiveClaim,
} from './use-create-emotive-claim.js'
import {
  nextWizardStep,
  previousWizardStep,
  wizardStepIndex,
  type WizardStep,
} from './wizard-steps.js'

export function EmotiveClaimCreateWizard(): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic')
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: customers } = useSuspenseQuery(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }),
  )
  const { data: engineTypes } = useSuspenseQuery(engineTypesReferenceOptions({ activeOnly: true }))
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions({ activeOnly: true }))
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions({ activeOnly: true }))
  const { data: externalParties } = useSuspenseQuery(
    externalPartiesReferenceOptions({ activeOnly: true }),
  )

  const createMutation = useCreateEmotiveClaim()

  const form = useForm({
    defaultValues: EMOTIVE_CLAIM_FORM_DEFAULTS,
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        const input = formValuesToCreateInput(value)
        await createMutation.mutateAsync(input)
      } catch (error) {
        setSubmitError(createEmotiveClaimErrorMessage(error))
      }
    },
  })

  const isPending = createMutation.isPending

  const validateCurrentStep = (values: EmotiveClaimFormValues): boolean => {
    if (currentStep === 'basic') {
      const result = emotiveClaimStepBasicSchema.safeParse(values)
      if (!result.success) {
        setStepErrors(formatZodFieldErrors(result.error))
        return false
      }
      setStepErrors({})
      return true
    }

    if (currentStep === 'faults') {
      if (values.faults.length === 0) {
        setStepErrors({})
        return true
      }
      const faultError = validateFaultDrafts(values.faults)
      if (faultError) {
        setStepErrors(formatZodFieldErrors(faultError))
        return false
      }
      setStepErrors({})
      return true
    }

    return true
  }

  const handleNext = (): void => {
    const values = form.state.values
    if (!validateCurrentStep(values)) {
      return
    }
    const next = nextWizardStep(currentStep)
    if (next) {
      setCurrentStep(next)
    }
  }

  const handleBack = (): void => {
    const prev = previousWizardStep(currentStep)
    if (prev) {
      setStepErrors({})
      setCurrentStep(prev)
    }
  }

  const stepTitle = (): string => {
    switch (currentStep) {
      case 'basic':
        return m.emotive_claims_create_step_basic_title()
      case 'faults':
        return m.emotive_claims_create_step_faults_title()
      case 'review':
        return m.emotive_claims_create_step_review_title()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.emotive_claims_create_title()}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {m.emotive_claims_create_step_indicator({
            current: wizardStepIndex(currentStep) + 1,
            total: 3,
          })}
          {' — '}
          {stepTitle()}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (currentStep === 'review') {
              void form.handleSubmit()
            }
          }}
          className="flex flex-col gap-6"
          noValidate
        >
          {currentStep === 'basic' ? (
            <StepBasicFields
              form={form}
              customers={customers}
              engineTypes={engineTypes}
              stepErrors={stepErrors}
              disabled={isPending}
            />
          ) : null}

          {currentStep === 'faults' ? (
            <StepFaultsFields
              form={form}
              departments={departments}
              employees={employees}
              externalParties={externalParties}
              stepErrors={stepErrors}
              disabled={isPending}
            />
          ) : null}

          {currentStep === 'review' ? (
            <StepReview
              values={form.state.values}
              customers={customers}
              engineTypes={engineTypes}
              departments={departments}
              employees={employees}
              externalParties={externalParties}
              form={form}
              disabled={isPending}
            />
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || previousWizardStep(currentStep) === null}
              onClick={handleBack}
            >
              {m.emotive_claims_create_back()}
            </Button>

            {currentStep === 'review' ? (
              <Button type="submit" loading={isPending}>
                {m.action_save()}
              </Button>
            ) : (
              <Button type="button" disabled={isPending} onClick={handleNext}>
                {m.emotive_claims_create_next()}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
