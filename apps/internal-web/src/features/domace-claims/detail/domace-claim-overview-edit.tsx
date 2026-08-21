import {
  ApiError,
  departmentsReferenceOptions,
  engineManufacturersReferenceOptions,
  employeesReferenceOptions,
  externalPartiesReferenceOptions,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'

import { CategoryFieldsGroup } from '../../claims/category-fields/category-fields-group.js'
import { DomaceBasicFields } from '../create/domace-basic-fields.js'
import { formatZodFieldErrors } from '../create/domace-claim-create-schemas.js'
import { validateFaultDrafts } from '../../emotive-claims/faults/fault-draft.js'
import { FaultRowsEditor } from '../../emotive-claims/faults/fault-rows-editor.js'
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

/**
 * "Izmeni podatke" — the basics, the amounts (docs/23, editable in any outcome state), the
 * category's answers and the faults, in one form and one save. Same shape as EMOTIVE's
 * {@link EmotiveClaimDataEdit}; the two families keep their own file, as the claims rules ask.
 */
export function DomaceClaimOverviewEdit({
  claim,
  onDone,
}: DomaceClaimOverviewEditProps): React.ReactElement {
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  // DOMACE ZAPOSLENI can be any active employee (not assembly-only), searchable — and a fault
  // may be pinned on any worker too, so the same list serves both here.
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions({ activeOnly: true }))
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions())
  const { data: externalParties } = useSuspenseQuery(externalPartiesReferenceOptions())

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const mutation = useUpdateDomaceClaimBasic(claim.id)

  const form = useForm({
    defaultValues: claimToDetailBasicValues(claim),
  })

  const handleSave = (): void => {
    const values = form.state.values

    const basics = domaceClaimDetailBasicSchema.safeParse(values)
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
    setFieldErrors({})
    setSaveError(null)
    onDone()
  }

  return (
    <div className="flex flex-col gap-4">
      <InternalCard title={m.domace_claims_create_section_basic()}>
        <div className="flex flex-col gap-4">
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

      {/* A green button that quietly does nothing is the worst thing on a screen: the guard is
          right to refuse an incomplete row, but it has to SAY so where the eye already is. */}
      {saveError === null && Object.keys(fieldErrors).length > 0 ? (
        <p className="text-[13px] text-mri-bad" role="alert">
          {m.claims_edit_blocked_hint()}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2.5">
        <InternalButton
          type="button"
          variant="outline"
          className="h-10 w-auto px-5 text-[11.5px] tracking-[0.06em]"
          disabled={mutation.isPending}
          onClick={handleCancel}
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
