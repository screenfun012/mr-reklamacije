import {
  ApiError,
  CustomerKind,
  customersReferenceOptions,
  engineManufacturersReferenceOptions,
  formatListDate,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import {
  EMOTIVE_CLAIM_FORM_DEFAULTS,
  emotiveClaimStepBasicSchema,
  formatZodFieldErrors,
  type EmotiveClaimFormValues,
} from '../create/emotive-claim-create-schemas.js'
import { StepBasicFields } from '../create/step-basic-fields.js'
import {
  useUpdateEmotiveClaimBasic,
  type EmotiveClaimBasicEdit,
} from './use-update-emotive-claim-basic.js'

const EMPTY = '—'

interface EmotiveClaimBasicSectionProps {
  claim: EmotiveClaimDetail
  /** Pending status + `emotive_claims.update` permission. */
  canEdit: boolean
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  /** When false, edit is triggered externally (detail header). Defaults to true. */
  showSectionEditButton?: boolean
  /** Hides MR in read-only grid when shown in page header. */
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

export function EmotiveClaimBasicSection({
  claim,
  canEdit,
  editing: controlledEditing,
  onEditingChange,
  showSectionEditButton = true,
  hideMrInReadOnly = false,
}: EmotiveClaimBasicSectionProps): React.ReactElement {
  const [editing, setEditing] = useControlledEditing(controlledEditing, onEditingChange)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <div className="flex items-center justify-between">
        <Heading level="h3" as="h2" className="text-foreground">
          {m.emotive_claims_detail_section_basic()}
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
  claim: EmotiveClaimDetail
  hideMr?: boolean
}): React.ReactElement {
  return (
    <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {hideMr ? null : (
          <DetailItem label={m.emotive_claims_col_mr_number()} value={claim.mrNumber} mono />
        )}
        <DetailItem label={m.emotive_claims_col_claim_number()} value={claim.claimNumber} />
        <DetailItem label={m.emotive_claims_col_partner()} value={claim.customerName} />
        <DetailItem label={m.emotive_claims_col_engine()} value={claim.engineTypeCode} mono />
        <DetailItem
          label={m.emotive_claims_detail_field_manufacturer()}
          value={claim.manufacturerName ?? claim.engineTypeManufacturer}
        />
        <DetailItem label={m.emotive_claims_detail_field_engine_code()} value={claim.engineCode} />
        <DetailItem label={m.emotive_claims_detail_field_source()} value={resolveSource(claim)} />
        <DetailItem label={m.emotive_claims_col_employee()} value={claim.employeeName} />
        <DetailItem
          label={m.emotive_claims_col_date_received()}
          value={formatListDate(claim.dateOfClaim)}
        />
        <DetailItem
          label={m.emotive_claims_col_date_finish()}
          value={claim.dateOfFinish ? formatListDate(claim.dateOfFinish) : null}
        />
        <DetailItem
          label={m.emotive_claims_detail_field_claim_year()}
          value={String(claim.claimYear)}
        />
      </dl>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">
          {m.emotive_claims_create_field_warranty_report()}
        </span>
        <p className="text-sm whitespace-pre-wrap text-foreground">
          {claim.warrantyReport ?? EMPTY}
        </p>
      </div>
    </>
  )
}

function BasicEditMode({
  claim,
  onDone,
}: {
  claim: EmotiveClaimDetail
  onDone: () => void
}): React.ReactElement {
  const { data: customers } = useSuspenseQuery(
    customersReferenceOptions({ kind: CustomerKind.EmotivePartner, activeOnly: true }),
  )
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const mutation = useUpdateEmotiveClaimBasic(claim.id)

  const form = useForm({
    defaultValues: claimToFormValues(claim),
  })

  const handleSave = (): void => {
    const values = form.state.values
    const result = emotiveClaimStepBasicSchema.safeParse(values)
    if (!result.success) {
      setStepErrors(formatZodFieldErrors(result.error))
      return
    }
    setStepErrors({})
    setSaveError(null)
    mutation.mutate(formValuesToBasicEdit(values), {
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
      <StepBasicFields
        form={form}
        customers={customers}
        manufacturers={manufacturers}
        orphanEngineType={
          claim.engineTypeId && claim.engineTypeCode
            ? { id: claim.engineTypeId, code: claim.engineTypeCode }
            : undefined
        }
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

function claimToFormValues(claim: EmotiveClaimDetail): EmotiveClaimFormValues {
  return {
    ...EMOTIVE_CLAIM_FORM_DEFAULTS,
    mrNumber: claim.mrNumber,
    claimNumber: claim.claimNumber ?? '',
    customerId: claim.customerId ?? '',
    manufacturerId: claim.manufacturerId ?? '',
    engineTypeId: claim.engineTypeId,
    engineCode: claim.engineCode ?? '',
    dateOfFinish: claim.dateOfFinish ?? '',
    dateOfClaim: claim.dateOfClaim,
    warrantyReport: claim.warrantyReport ?? '',
  }
}

function formValuesToBasicEdit(values: EmotiveClaimFormValues): EmotiveClaimBasicEdit {
  const claimNumber = values.claimNumber.trim()
  const engineCode = values.engineCode.trim()
  const dateOfFinish = values.dateOfFinish.trim()
  return {
    mrNumber: values.mrNumber.trim(),
    claimNumber: claimNumber === '' ? null : claimNumber,
    customerId: values.customerId,
    manufacturerId: values.manufacturerId.trim() === '' ? null : values.manufacturerId,
    engineTypeId: values.engineTypeId,
    engineCode: engineCode === '' ? null : engineCode,
    dateOfClaim: values.dateOfClaim,
    dateOfFinish: dateOfFinish === '' ? null : dateOfFinish,
  }
}

function resolveSource(claim: EmotiveClaimDetail): string | null {
  if (claim.sourceName && claim.sourceCode) {
    return `${claim.sourceName} (${claim.sourceCode})`
  }
  return claim.sourceName ?? claim.sourceCode
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
