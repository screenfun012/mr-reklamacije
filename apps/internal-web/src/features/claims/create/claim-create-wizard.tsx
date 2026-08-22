import { m } from '@mr/i18n'
import {
  ClaimKind,
  CustomerKind,
  assignedWorkerReferenceOptions,
  claimCategoriesReferenceOptions,
  customersReferenceOptions,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  externalPartiesReferenceOptions,
  mrConflictFromError,
  type ClaimCategoryListItem,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { InternalNote } from '~/components/internal-note'
import { WizardStepper } from '~/components/wizard-stepper'

import { DomaceBasicFields } from '../../domace-claims/create/domace-basic-fields.js'
import { StepBasicFields } from '../../emotive-claims/create/step-basic-fields.js'
import { StepFaultsFields } from '../../emotive-claims/create/step-faults-fields.js'
import { CategoryChipMenu } from '../category-fields/category-chip-menu.js'
import { CategoryFieldsGroup } from '../category-fields/category-fields-group.js'
import { MrConflictLink } from '../mr-conflict-link.js'
import {
  CLAIM_CREATE_FORM_DEFAULTS,
  formatZodFieldErrors,
  validateClaimBasicStep,
  formValuesToDomaceInput,
  formValuesToEmotiveInput,
  validateFaultDrafts,
  type ClaimCreateFormValues,
} from './claim-create-schemas.js'
import { StepKind } from './step-kind.js'
import { StepReview } from './step-review.js'
import { createClaimErrorMessage, useCreateClaim } from './use-create-claim.js'
import {
  CLAIM_WIZARD_STEPS,
  claimWizardStepIndex,
  claimWizardStepLabel,
  claimWizardStepTitle,
  nextClaimWizardStep,
  previousClaimWizardStep,
  type ClaimWizardStep,
} from './wizard-steps.js'

export interface ClaimCreateWizardProps {
  /** The kind of work this claim is about, decided before the wizard opened. */
  category: ClaimCategoryListItem
  canCreateEmotive: boolean
  canCreateDomace: boolean
  onLeave: () => void
}

/**
 * One wizard for both kinds of claim (prototype: VRSTA → PODACI → KVAROVI → PREGLED). DOMAĆA used
 * to be a single long form; it now walks the same steps and only adds the money fields to step 2.
 *
 * The CATEGORY is not a field here. It arrives with the wizard — from the menu entry or the list
 * you started in — and lives in the header chip, where changing it is a deliberate act that costs
 * the answers already given (confirmed first, never silently).
 */
export function ClaimCreateWizard({
  category,
  canCreateEmotive,
  canCreateDomace,
  onLeave,
}: ClaimCreateWizardProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<ClaimWizardStep>('kind')
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitConflict, setSubmitConflict] = useState<MrRegistryExistingClaim | null>(null)
  const [activeCategory, setActiveCategory] = useState(category)
  const [pendingCategory, setPendingCategory] = useState<ClaimCategoryListItem | null>(null)

  const { data: customers } = useSuspenseQuery(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }),
  )
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  const { data: categories } = useSuspenseQuery(
    claimCategoriesReferenceOptions({ activeOnly: true }),
  )
  // Three rosters, deliberately: EMOTIVE's assigned worker is assembly-only, DOMAĆA's ZAPOSLENI
  // and fault attribution are every active worker (docs/23).
  const { data: assignedWorkers } = useSuspenseQuery(assignedWorkerReferenceOptions())
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions({ activeOnly: true }))
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions({ activeOnly: true }))
  const { data: externalParties } = useSuspenseQuery(
    externalPartiesReferenceOptions({ activeOnly: true }),
  )

  const createMutation = useCreateClaim()

  const form = useForm({
    defaultValues: { ...CLAIM_CREATE_FORM_DEFAULTS, categoryId: category.id },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setSubmitConflict(null)
      try {
        await createMutation.mutateAsync(
          value.kind === ClaimKind.Domace
            ? { kind: ClaimKind.Domace, input: formValuesToDomaceInput(value) }
            : { kind: ClaimKind.Emotive, input: formValuesToEmotiveInput(value) },
        )
      } catch (error) {
        setSubmitError(createClaimErrorMessage(error))
        setSubmitConflict(mrConflictFromError(error))
      }
    },
  })

  const isPending = createMutation.isPending

  function validateCurrentStep(values: ClaimCreateFormValues): boolean {
    if (currentStep === 'basic') {
      const errors = validateClaimBasicStep(values)
      setStepErrors(errors)
      return Object.keys(errors).length === 0
    }
    if (currentStep === 'faults') {
      const error = validateFaultDrafts(values.faults)
      setStepErrors(error === null ? {} : formatZodFieldErrors(error))
      return error === null
    }
    setStepErrors({})
    return true
  }

  function goNext(): void {
    if (!validateCurrentStep(form.state.values)) {
      return
    }
    const next = nextClaimWizardStep(currentStep)
    if (next !== null) {
      setCurrentStep(next)
    }
  }

  function goBack(): void {
    const previous = previousClaimWizardStep(currentStep)
    setStepErrors({})
    if (previous !== null) {
      setCurrentStep(previous)
    }
  }

  function pickKind(kind: ClaimKind): void {
    form.setFieldValue('kind', kind)
    setCurrentStep('basic')
  }

  function applyCategory(next: ClaimCategoryListItem): void {
    // The answers belong to the category they were given under, so moving before saving throws
    // them away — that is what the confirmation ahead of this warns about.
    setActiveCategory(next)
    form.setFieldValue('categoryId', next.id)
    form.setFieldValue('categoryFieldValues', {})
    setPendingCategory(null)
  }

  function requestCategory(next: ClaimCategoryListItem): void {
    const answered = Object.values(form.state.values.categoryFieldValues).some(
      (value) => value.length > 0,
    )
    if (answered) {
      setPendingCategory(next)
      return
    }
    applyCategory(next)
  }

  const stepIndex = claimWizardStepIndex(currentStep)
  const isDomace = form.state.values.kind === ClaimKind.Domace

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3.5">
        {/* Its own line below sm: beside the title it pushed the heading ~120px in from the left
            while the card under it stayed at the edge, which reads as a broken layout. */}
        <button
          type="button"
          onClick={onLeave}
          className="basis-full cursor-pointer text-left text-xs font-bold uppercase tracking-[0.06em] text-mri-text2 transition-colors hover:text-mri-text sm:basis-auto"
        >
          ← {m.emotive_claims_create_back()}
        </button>
        <div className="flex flex-col gap-[3px]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">
            {m.crumb_new_claim()}
          </span>
          <h1 className="text-[22px] font-black tracking-[-0.02em] text-mri-text">
            {claimWizardStepTitle(currentStep)}
          </h1>
        </div>
        <span className="ml-auto">
          <CategoryChipMenu
            categories={categories}
            categoryId={activeCategory.id}
            categoryName={activeCategory.name}
            onPick={requestCategory}
            disabled={isPending}
          />
        </span>
      </div>

      <WizardStepper
        variant="claims"
        steps={CLAIM_WIZARD_STEPS.map(claimWizardStepLabel)}
        currentIndex={stepIndex}
      />

      {currentStep === 'kind' ? (
        <StepKind
          onPick={pickKind}
          canCreateEmotive={canCreateEmotive}
          canCreateDomace={canCreateDomace}
        />
      ) : null}

      {currentStep === 'basic' ? (
        <InternalCard className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">
              {m.claim_wizard_step_basic()}
            </span>
            <span
              className={
                isDomace
                  ? 'rounded-full bg-mri-domace-bg px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-mri-domace'
                  : 'rounded-full bg-mri-info-bg px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-mri-info'
              }
            >
              {isDomace ? m.claims_kind_domace() : m.claims_kind_emotive()}
            </span>
          </div>

          {isDomace ? (
            <DomaceBasicFields
              form={form as never}
              // DOMAĆA's ZAPOSLENI takes EVERY active worker (docs/23), not the assembly-only
              // roster EMOTIVE's "zaduženi radnik" uses. Two fields, two lists — passing one to
              // both is the 2026-07-23 trap.
              employees={employees}
              manufacturers={manufacturers}
              stepErrors={stepErrors}
              disabled={isPending}
              checkMrDuplicate
            />
          ) : (
            <StepBasicFields
              form={form as never}
              customers={customers}
              manufacturers={manufacturers}
              employees={assignedWorkers}
              stepErrors={stepErrors}
              disabled={isPending}
              checkMrDuplicate
            />
          )}

          <form.Subscribe
            selector={(state: { values: ClaimCreateFormValues }) =>
              state.values.categoryFieldValues
            }
            children={(values: ClaimCreateFormValues['categoryFieldValues']) => (
              <CategoryFieldsGroup
                categoryId={activeCategory.id}
                categoryName={activeCategory.name}
                values={values}
                onChange={(next) => form.setFieldValue('categoryFieldValues', next)}
                disabled={isPending}
              />
            )}
          />
        </InternalCard>
      ) : null}

      {currentStep === 'faults' ? (
        <InternalCard className="flex flex-col gap-3 p-5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">
            {m.claim_wizard_step_faults()}
          </span>
          <StepFaultsFields
            form={form as never}
            employees={employees}
            departments={departments}
            externalParties={externalParties}
            stepErrors={stepErrors}
            disabled={isPending}
          />
        </InternalCard>
      ) : null}

      {currentStep === 'review' ? (
        <StepReview
          form={form as never}
          category={activeCategory}
          customers={customers}
          manufacturers={manufacturers}
          employees={assignedWorkers}
        />
      ) : null}

      {submitError !== null ? (
        <InternalNote tone="error">
          {submitError}
          {submitConflict !== null ? <MrConflictLink existing={submitConflict} /> : null}
        </InternalNote>
      ) : null}

      {currentStep !== 'kind' ? (
        <div className="flex gap-2.5">
          <InternalButton
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={isPending}
            className="h-[42px] w-auto px-[18px] text-xs"
          >
            {m.emotive_claims_create_back()}
          </InternalButton>
          {currentStep === 'review' ? (
            <InternalButton
              type="button"
              variant="green"
              className="ml-auto h-[42px] w-auto px-[22px] text-xs"
              onClick={() => void form.handleSubmit()}
              disabled={isPending}
            >
              ✓ {m.action_save()}
            </InternalButton>
          ) : (
            <InternalButton
              type="button"
              className="ml-auto h-[42px] w-auto px-[22px] text-xs"
              onClick={goNext}
              disabled={isPending}
            >
              {m.emotive_claims_create_next()}
            </InternalButton>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCategory(null)
          }
        }}
        title={m.claim_category_discard_title()}
        description={m.claim_category_discard_description({
          from: activeCategory.name,
          to: pendingCategory?.name ?? '',
        })}
        confirmLabel={m.claim_category_discard_confirm()}
        onConfirm={() => {
          if (pendingCategory !== null) {
            applyCategory(pendingCategory)
          }
        }}
      />
    </div>
  )
}
