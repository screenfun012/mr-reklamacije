import {
  ApiError,
  CustomerKind,
  assignedWorkerReferenceOptions,
  customersReferenceOptions,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  engineManufacturersReferenceOptions,
  externalPartiesReferenceOptions,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { useState } from 'react'

import { CategoryFieldsGroup } from '../../claims/category-fields/category-fields-group.js'
import {
  EMOTIVE_CLAIM_FORM_DEFAULTS,
  emotiveClaimStepBasicSchema,
  formatZodFieldErrors,
  validateFaultDrafts,
  type EmotiveClaimFormValues,
} from '../create/emotive-claim-create-schemas.js'
import { StepBasicFields } from '../create/step-basic-fields.js'
import { faultDraftsToInput, faultItemToDraft } from '../faults/fault-draft.js'
import { FaultRowsEditor } from '../faults/fault-rows-editor.js'
import {
  useUpdateEmotiveClaimBasic,
  type EmotiveClaimBasicEdit,
} from './use-update-emotive-claim-basic.js'

export interface EmotiveClaimDataEditProps {
  claim: EmotiveClaimDetail
  onDone: () => void
}

/**
 * "Izmeni podatke" — everything a claim IS, in one form and one save: the basic fields, the
 * answers its kind of work asks for, and who it blames.
 *
 * The faults are here rather than in a tab of their own because they are part of the claim's
 * data, not a second document about it — the wizard asks for them in the same run, the API
 * takes them in the same PATCH, and the server writes claim + faults in one transaction
 * (docs/04). Split across two saves, half a correction could land and the other half not.
 */
export function EmotiveClaimDataEdit({
  claim,
  onDone,
}: EmotiveClaimDataEditProps): React.ReactElement {
  const { data: customers } = useSuspenseQuery(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }),
  )
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  // TWO employee lists on purpose: the assigned worker comes from the assembly departments
  // only, while a fault may be pinned on ANY worker in the shop.
  const { data: assignedWorkers } = useSuspenseQuery(assignedWorkerReferenceOptions())
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions())
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions())
  const { data: externalParties } = useSuspenseQuery(externalPartiesReferenceOptions())

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const mutation = useUpdateEmotiveClaimBasic(claim.id)

  const form = useForm({
    defaultValues: claimToFormValues(claim),
  })

  const handleSave = (): void => {
    const values = form.state.values

    const basics = emotiveClaimStepBasicSchema.safeParse(values)
    const faultErrors = validateFaultDrafts(values.faults)
    if (!basics.success || faultErrors !== null) {
      setFieldErrors({
        ...(basics.success ? {} : formatZodFieldErrors(basics.error)),
        ...(faultErrors === null ? {} : formatZodFieldErrors(faultErrors)),
      })
      return
    }

    setFieldErrors({})
    setSaveError(null)
    mutation.mutate(formValuesToPatch(values), {
      onSuccess: () => onDone(),
      onError: (error) => {
        setSaveError(
          error instanceof ApiError && error.status === 409
            ? m.emotive_claims_detail_basic_locked_error()
            : m.emotive_claims_detail_basic_save_error(),
        )
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <InternalCard title={m.emotive_claims_detail_section_basic()}>
        <div className="flex flex-col gap-4">
          <StepBasicFields
            form={form}
            customers={customers}
            employees={assignedWorkers}
            manufacturers={manufacturers}
            orphanEngineType={
              claim.engineTypeId && claim.engineTypeCode
                ? { id: claim.engineTypeId, code: claim.engineTypeCode }
                : undefined
            }
            currentAssignedWorkerName={claim.employeeName ?? undefined}
            stepErrors={fieldErrors}
            disabled={mutation.isPending}
          />

          {claim.category === null ? null : (
            <form.Subscribe
              selector={(state) => state.values.categoryFieldValues}
              children={(values) => (
                <CategoryFieldsGroup
                  categoryId={claim.category?.id ?? ''}
                  categoryName={claim.category?.name ?? ''}
                  values={values}
                  onChange={(next) => form.setFieldValue('categoryFieldValues', next)}
                  disabled={mutation.isPending}
                />
              )}
            />
          )}
        </div>
      </InternalCard>

      <InternalCard title={m.claim_detail_faults_title()}>
        <form.Subscribe
          selector={(state) => state.values.faults}
          children={(faults) => (
            <FaultRowsEditor
              value={faults}
              onChange={(next) => form.setFieldValue('faults', next)}
              departments={departments}
              employees={employees}
              externalParties={externalParties}
              errors={fieldErrors}
              disabled={mutation.isPending}
            />
          )}
        />
      </InternalCard>

      {saveError ? (
        <p className="text-[13px] text-mri-bad" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2.5">
        <InternalButton
          type="button"
          variant="outline"
          className="h-10 w-auto px-5 text-[11.5px] tracking-[0.06em]"
          disabled={mutation.isPending}
          onClick={() => {
            setFieldErrors({})
            setSaveError(null)
            onDone()
          }}
        >
          {m.emotive_claims_detail_basic_cancel()}
        </InternalButton>
        <InternalButton
          type="button"
          variant="green"
          className="h-10 w-auto px-5 text-[11.5px] tracking-[0.06em]"
          disabled={mutation.isPending}
          onClick={handleSave}
        >
          <span aria-hidden="true" className="font-normal">
            ✓
          </span>
          {m.emotive_claims_detail_basic_save()}
        </InternalButton>
      </div>
    </div>
  )
}

function claimToFormValues(claim: EmotiveClaimDetail): EmotiveClaimFormValues {
  return {
    ...EMOTIVE_CLAIM_FORM_DEFAULTS,
    mrNumber: claim.mrNumber,
    claimNumber: claim.claimNumber ?? '',
    customerId: claim.customerId ?? '',
    manufacturerId: claim.manufacturerId ?? '',
    categoryId: claim.category?.id ?? '',
    categoryFieldValues: claim.categoryFieldValues,
    engineTypeId: claim.engineTypeId,
    engineCode: claim.engineCode ?? '',
    dateOfFinish: claim.dateOfFinish ?? '',
    dateOfClaim: claim.dateOfClaim,
    warrantyReport: claim.warrantyReport ?? '',
    employeeId: claim.employeeId ?? '',
    faults: claim.faults.map(faultItemToDraft),
  }
}

function formValuesToPatch(values: EmotiveClaimFormValues): EmotiveClaimBasicEdit {
  const claimNumber = values.claimNumber.trim()
  const engineCode = values.engineCode.trim()
  const dateOfFinish = values.dateOfFinish.trim()
  const warrantyReport = values.warrantyReport.trim()
  return {
    mrNumber: values.mrNumber.trim(),
    claimNumber: claimNumber === '' ? null : claimNumber,
    customerId: values.customerId,
    manufacturerId: values.manufacturerId.trim() === '' ? null : values.manufacturerId,
    categoryId: values.categoryId,
    categoryFieldValues: values.categoryFieldValues,
    engineTypeId: values.engineTypeId,
    engineCode: engineCode === '' ? null : engineCode,
    dateOfClaim: values.dateOfClaim,
    dateOfFinish: dateOfFinish === '' ? null : dateOfFinish,
    employeeId: values.employeeId.trim() === '' ? null : values.employeeId,
    faults: faultDraftsToInput(values.faults),
    ...(warrantyReport !== '' ? { warrantyReport } : {}),
  }
}
