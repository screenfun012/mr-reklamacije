import {
  ApiError,
  engineManufacturersReferenceOptions,
  employeesReferenceOptions,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { CategoryFieldsGroup } from '../../claims/category-fields/category-fields-group.js'
import { DomaceBasicFields } from '../create/domace-basic-fields.js'
import {
  formatZodFieldErrors,
  type DomaceClaimFormValues,
} from '../create/domace-claim-create-schemas.js'
import { faultItemToDraft } from '../../emotive-claims/faults/fault-draft.js'
import {
  claimToDetailBasicValues,
  detailBasicValuesToPatch,
  domaceClaimDetailBasicSchema,
} from './domace-claim-detail-schemas.js'
import { useUpdateDomaceClaimBasic } from './use-update-domace-claim-basic.js'

export interface DomaceClaimOverviewEditProps {
  claim: DomaceClaimDetail
  onDone: () => void
}

// Amounts (docs/23) are now part of the basic edit and editable in any outcome
// state, so there is one edit path — no accepted-only branch.
export function DomaceClaimOverviewEdit({
  claim,
  onDone,
}: DomaceClaimOverviewEditProps): React.ReactElement {
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  // DOMACE ZAPOSLENI can be any active employee (not assembly-only), searchable.
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions({ activeOnly: true }))
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const mutation = useUpdateDomaceClaimBasic(claim.id)

  const form = useForm({
    defaultValues: {
      ...claimToDetailBasicValues(claim),
      faults: claim.faults.map(faultItemToDraft),
    } satisfies DomaceClaimFormValues,
  })

  const handleSave = (): void => {
    const values = form.state.values
    const result = domaceClaimDetailBasicSchema.safeParse(values)
    if (!result.success) {
      setStepErrors(formatZodFieldErrors(result.error))
      return
    }
    setStepErrors({})
    setSaveError(null)
    mutation.mutate(detailBasicValuesToPatch(values), {
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

  const handleCancel = (): void => {
    setStepErrors({})
    setSaveError(null)
    onDone()
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
        <h2 className="text-[15px] font-extrabold text-mri-text">
          {m.domace_claims_create_section_basic()}
        </h2>

        <DomaceBasicFields
          form={form}
          employees={employees}
          manufacturers={manufacturers}
          orphanEngineType={
            claim.engineTypeId && claim.engineTypeCode
              ? { id: claim.engineTypeId, code: claim.engineTypeCode }
              : undefined
          }
          currentAssignedWorkerName={claim.employeeName ?? undefined}
          stepErrors={stepErrors}
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
      </section>

      <OverviewEditFooter
        saveError={saveError}
        isPending={mutation.isPending}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}

function OverviewEditFooter({
  saveError,
  isPending,
  onSave,
  onCancel,
}: {
  saveError: string | null
  isPending: boolean
  onSave: () => void
  onCancel: () => void
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {saveError ? (
        <p className="text-sm text-mri-bad" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={onSave} loading={isPending}>
          {m.emotive_claims_detail_basic_save()}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          {m.emotive_claims_detail_basic_cancel()}
        </Button>
      </div>
    </div>
  )
}
