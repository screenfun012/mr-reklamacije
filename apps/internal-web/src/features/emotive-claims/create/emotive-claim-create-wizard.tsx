import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  CustomerKind,
  customersReferenceOptions,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  externalPartiesReferenceOptions,
  mrConflictFromError,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { InternalNote } from '~/components/internal-note'
import { WizardStepper } from '~/components/wizard-stepper'

import { MrConflictLink } from '../../claims/mr-conflict-link.js'
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
  const [submitConflict, setSubmitConflict] = useState<MrRegistryExistingClaim | null>(null)

  const { data: customers } = useSuspenseQuery(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }),
  )
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
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
      setSubmitConflict(null)
      try {
        const input = formValuesToCreateInput(value)
        await createMutation.mutateAsync(input)
      } catch (error) {
        setSubmitError(createEmotiveClaimErrorMessage(error))
        setSubmitConflict(mrConflictFromError(error))
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

  const stepLabels = [
    m.emotive_claims_create_step_basic_title(),
    m.emotive_claims_create_step_faults_title(),
    m.emotive_claims_create_step_review_title(),
  ]

  return (
    <div className="mri-fade-up flex flex-col" style={{ animationDelay: '0.1s' }}>
      <WizardStepper steps={stepLabels} currentIndex={wizardStepIndex(currentStep)} />
      <InternalCard className="p-6 sm:p-7">
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
              employees={employees}
              manufacturers={manufacturers}
              stepErrors={stepErrors}
              disabled={isPending}
              checkMrDuplicate
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
              manufacturers={manufacturers}
              departments={departments}
              employees={employees}
              externalParties={externalParties}
              form={form}
              disabled={isPending}
            />
          ) : null}

          {submitError ? (
            <InternalNote tone="error" role="alert">
              {submitError}
              {submitConflict ? (
                <>
                  {' '}
                  <MrConflictLink existing={submitConflict} />
                </>
              ) : null}
            </InternalNote>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <InternalButton
              type="button"
              variant="outline"
              className="h-[46px] w-auto px-6 text-[12.5px]"
              disabled={isPending || previousWizardStep(currentStep) === null}
              onClick={handleBack}
            >
              <span aria-hidden="true" className="font-normal">
                ←
              </span>{' '}
              {m.emotive_claims_create_back()}
            </InternalButton>

            {/* Submit explicitly via onClick, not a native type="submit": the primary
                CTA reuses one <button> node across steps, so a submit button would fire
                on the faults→review transition and save the claim before review is shown. */}
            {currentStep === 'review' ? (
              <InternalButton
                type="button"
                variant="green"
                className="h-[46px] w-auto px-6 text-[12.5px]"
                disabled={isPending}
                onClick={() => void form.handleSubmit()}
              >
                <span aria-hidden="true" className="font-normal">
                  ✓
                </span>{' '}
                {m.action_save()}
              </InternalButton>
            ) : (
              <InternalButton
                type="button"
                variant="primary"
                className="h-[46px] w-auto px-6 text-[12.5px]"
                disabled={isPending}
                onClick={handleNext}
              >
                {m.emotive_claims_create_next()}{' '}
                <span aria-hidden="true" className="font-normal">
                  →
                </span>
              </InternalButton>
            )}
          </div>
        </form>
      </InternalCard>
    </div>
  )
}
