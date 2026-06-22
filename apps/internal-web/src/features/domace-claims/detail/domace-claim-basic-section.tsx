import {
  ApiError,
  engineTypesReferenceOptions,
  formatListDate,
  type DomaceClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

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

const EMPTY = '—'

interface DomaceClaimBasicSectionProps {
  claim: DomaceClaimDetail
  canEdit: boolean
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  showSectionEditButton?: boolean
  hideMrInReadOnly?: boolean
}

function useControlledEditing(
  controlledEditing: boolean | undefined,
  onEditingChange: ((editing: boolean) => void) | undefined,
): [boolean, (editing: boolean) => void] {
  const [internalEditing, setInternalEditing] = useState(false)
  const editing = controlledEditing ?? internalEditing
  const setEditing = onEditingChange ?? setInternalEditing
  return [editing, setEditing]
}

export function DomaceClaimBasicSection({
  claim,
  canEdit,
  editing: controlledEditing,
  onEditingChange,
  showSectionEditButton = true,
  hideMrInReadOnly = false,
}: DomaceClaimBasicSectionProps): React.ReactElement {
  const [editing, setEditing] = useControlledEditing(controlledEditing, onEditingChange)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <div className="flex items-center justify-between">
        <Heading level="h3" as="h2" className="text-foreground">
          {m.domace_claims_create_section_basic()}
        </Heading>
        {canEdit && !editing && showSectionEditButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
            {m.emotive_claims_detail_basic_edit()}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <BasicEditMode claim={claim} onDone={() => setEditing(false)} />
      ) : (
        <BasicReadOnly claim={claim} hideMr={hideMrInReadOnly} />
      )}
    </section>
  )
}

function BasicReadOnly({
  claim,
  hideMr = false,
}: {
  claim: DomaceClaimDetail
  hideMr?: boolean
}): React.ReactElement {
  return (
    <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {hideMr ? null : (
          <DetailItem
            label={m.domace_claims_create_field_mr_number()}
            value={claim.mrNumber}
            mono
          />
        )}
        <DetailItem label={m.domace_claims_create_field_claim_number()} value={claim.claimNumber} />
        <DetailItem
          label={m.domace_claims_create_field_customer_name()}
          value={claim.customerName}
        />
        <DetailItem
          label={m.domace_claims_create_field_engine_type()}
          value={claim.engineTypeCode}
        />
        <DetailItem
          label={m.emotive_claims_detail_field_manufacturer()}
          value={claim.engineTypeManufacturer}
        />
        <DetailItem label={m.domace_claims_create_field_engine_code()} value={claim.engineCode} />
        <DetailItem
          label={m.domace_claims_create_field_date_finish()}
          value={claim.dateOfFinish ? formatListDate(claim.dateOfFinish) : null}
        />
        <DetailItem
          label={m.domace_claims_create_field_date_claim()}
          value={claim.dateOfClaim ? formatListDate(claim.dateOfClaim) : null}
        />
        <DetailItem
          label={m.domace_claims_detail_field_claim_year()}
          value={String(claim.claimYear)}
        />
      </dl>
      <div className="flex flex-col gap-0.5 text-sm">
        <dt className="text-muted-foreground">{m.domace_claims_create_field_warranty_report()}</dt>
        <dd className="whitespace-pre-wrap font-medium text-foreground">
          {claim.warrantyReport ?? EMPTY}
        </dd>
      </div>
    </>
  )
}

function BasicEditMode({
  claim,
  onDone,
}: {
  claim: DomaceClaimDetail
  onDone: () => void
}): React.ReactElement {
  const { data: engineTypes } = useSuspenseQuery(engineTypesReferenceOptions({ activeOnly: true }))
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

  return (
    <div className="flex flex-col gap-4">
      <DomaceBasicFields
        form={form}
        engineTypes={engineTypes}
        stepErrors={stepErrors}
        disabled={mutation.isPending}
      />

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} loading={mutation.isPending}>
          {m.emotive_claims_detail_basic_save()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => {
            setStepErrors({})
            setSaveError(null)
            onDone()
          }}
        >
          {m.emotive_claims_detail_basic_cancel()}
        </Button>
      </div>
    </div>
  )
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null
  mono?: boolean
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-xs text-foreground' : 'font-medium text-foreground'}>
        {value ?? EMPTY}
      </dd>
    </div>
  )
}
