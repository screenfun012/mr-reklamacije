import {
  ApiError,
  ClaimOutcome,
  engineManufacturersReferenceOptions,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { DomaceBasicFields } from '../create/domace-basic-fields.js'
import {
  formatZodFieldErrors,
  type DomaceClaimFormValues,
} from '../create/domace-claim-create-schemas.js'
import { faultItemToDraft } from '../../emotive-claims/faults/fault-draft.js'
import { DomaceClaimBasicReadOnly } from './domace-claim-basic-section.js'
import {
  claimToDetailBasicValues,
  detailBasicValuesToPatch,
  domaceClaimDetailBasicSchema,
} from './domace-claim-detail-schemas.js'
import {
  DomaceClaimAmountEditField,
  formatAmountInput,
  parseDomaceAmountInput,
  resolveAmountSaveError,
} from './domace-claim-amount-section.js'
import { useUpdateDomaceClaimAmount } from './use-update-domace-claim-amount.js'
import { useUpdateDomaceClaimBasic } from './use-update-domace-claim-basic.js'

export interface DomaceClaimOverviewEditProps {
  claim: DomaceClaimDetail
  onDone: () => void
}

export function DomaceClaimOverviewEdit({
  claim,
  onDone,
}: DomaceClaimOverviewEditProps): React.ReactElement {
  const isPending = claim.outcome === ClaimOutcome.Pending
  const isAccepted = claim.outcome === ClaimOutcome.Accepted

  if (isPending) {
    return <PendingOverviewEdit claim={claim} onDone={onDone} />
  }

  if (isAccepted) {
    return <AcceptedOverviewEdit claim={claim} onDone={onDone} />
  }

  return <DomaceClaimBasicReadOnly claim={claim} hideMr />
}

function PendingOverviewEdit({
  claim,
  onDone,
}: {
  claim: DomaceClaimDetail
  onDone: () => void
}): React.ReactElement {
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
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
          manufacturers={manufacturers}
          orphanEngineType={
            claim.engineTypeId && claim.engineTypeCode
              ? { id: claim.engineTypeId, code: claim.engineTypeCode }
              : undefined
          }
          stepErrors={stepErrors}
          disabled={mutation.isPending}
        />
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

function AcceptedOverviewEdit({
  claim,
  onDone,
}: {
  claim: DomaceClaimDetail
  onDone: () => void
}): React.ReactElement {
  const [amountInput, setAmountInput] = useState(() => formatAmountInput(claim.totalAmount))
  const [saveError, setSaveError] = useState<string | null>(null)
  const mutation = useUpdateDomaceClaimAmount(claim.id)

  const handleSave = (): void => {
    setSaveError(null)
    const parsed = parseDomaceAmountInput(amountInput)
    if (!parsed.ok) {
      setSaveError(parsed.error)
      return
    }

    mutation.mutate(parsed.value, {
      onSuccess: () => onDone(),
      onError: (error) => setSaveError(resolveAmountSaveError(error)),
    })
  }

  const handleCancel = (): void => {
    setSaveError(null)
    setAmountInput(formatAmountInput(claim.totalAmount))
    onDone()
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
        <h2 className="text-[15px] font-extrabold text-mri-text">
          {m.domace_claims_create_section_basic()}
        </h2>
        <DomaceClaimBasicReadOnly claim={claim} hideMr />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
        <h2 className="text-[15px] font-extrabold text-mri-text">
          {m.domace_claims_detail_section_amount()}
        </h2>
        <DomaceClaimAmountEditField
          amountInput={amountInput}
          onAmountInputChange={setAmountInput}
          disabled={mutation.isPending}
        />
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
