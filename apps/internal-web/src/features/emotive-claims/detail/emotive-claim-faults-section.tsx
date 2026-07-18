import {
  ApiError,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  externalPartiesReferenceOptions,
  FaultType,
  type EmotiveClaimDetail,
  type EmotiveClaimFaultItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

import {
  formatZodFieldErrors,
  validateFaultDrafts,
  type EmotiveClaimFaultDraft,
} from '../create/emotive-claim-create-schemas.js'
import { faultDraftsToInput, faultItemToDraft } from '../faults/fault-draft.js'
import { FaultRowsEditor } from '../faults/fault-rows-editor.js'
import { useUpdateEmotiveClaimFaults } from './use-update-emotive-claim-faults.js'

const EMPTY = '—'

interface EmotiveClaimFaultsSectionProps {
  claim: EmotiveClaimDetail
  /** `emotive_claims.update` permission. */
  canEdit: boolean
}

export function EmotiveClaimFaultsSection({
  claim,
  canEdit,
}: EmotiveClaimFaultsSectionProps): React.ReactElement {
  const [editing, setEditing] = useState(false)

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold text-mri-text">
          {m.emotive_claims_detail_section_faults()}
        </h2>
        {canEdit && !editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
            {m.emotive_claims_detail_faults_edit()}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <FaultsEditMode claim={claim} onDone={() => setEditing(false)} />
      ) : (
        <FaultsReadOnly faults={claim.faults} />
      )}
    </section>
  )
}

function FaultsReadOnly({ faults }: { faults: EmotiveClaimFaultItem[] }): React.ReactElement {
  if (faults.length === 0) {
    return <p className="text-sm text-mri-text2">{m.emotive_claims_detail_faults_empty()}</p>
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-mri-border bg-mri-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-mri-inbg text-left">
          <tr>
            <th className="px-4 py-2 font-medium text-mri-text2">
              {m.emotive_claims_create_fault_type()}
            </th>
            <th className="px-4 py-2 font-medium text-mri-text2">
              {m.emotive_claims_create_review_fault_target()}
            </th>
            <th className="px-4 py-2 font-medium text-mri-text2">
              {m.emotive_claims_detail_fault_notes()}
            </th>
          </tr>
        </thead>
        <tbody>
          {faults.map((fault) => (
            <tr key={fault.id} className="border-t border-mri-border">
              <td className="px-4 py-2">{faultLabel(fault.faultType)}</td>
              <td className="px-4 py-2">{resolveFaultTarget(fault)}</td>
              <td className="px-4 py-2 text-mri-text2">{fault.notes ?? EMPTY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FaultsEditMode({
  claim,
  onDone,
}: {
  claim: EmotiveClaimDetail
  onDone: () => void
}): React.ReactElement {
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions())
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions())
  const { data: externalParties } = useSuspenseQuery(externalPartiesReferenceOptions())

  const [drafts, setDrafts] = useState<EmotiveClaimFaultDraft[]>(() =>
    claim.faults.map(faultItemToDraft),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const mutation = useUpdateEmotiveClaimFaults(claim.id)

  const handleSave = (): void => {
    const validation = validateFaultDrafts(drafts)
    if (validation) {
      setFieldErrors(formatZodFieldErrors(validation))
      return
    }
    setFieldErrors({})
    setSaveError(null)
    mutation.mutate(faultDraftsToInput(drafts), {
      onSuccess: () => onDone(),
      onError: (error) => {
        setSaveError(
          error instanceof ApiError && error.status === 409
            ? m.emotive_claims_detail_faults_locked_error()
            : m.emotive_claims_detail_faults_save_error(),
        )
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <FaultRowsEditor
        value={drafts}
        onChange={setDrafts}
        departments={departments}
        employees={employees}
        externalParties={externalParties}
        errors={fieldErrors}
        disabled={mutation.isPending}
      />

      {saveError ? (
        <p className="text-sm text-mri-bad" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} loading={mutation.isPending}>
          {m.emotive_claims_detail_faults_save()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => {
            setDrafts(claim.faults.map(faultItemToDraft))
            setFieldErrors({})
            setSaveError(null)
            onDone()
          }}
        >
          {m.emotive_claims_detail_faults_cancel()}
        </Button>
      </div>
    </div>
  )
}

function resolveFaultTarget(fault: EmotiveClaimFaultItem): string {
  switch (fault.faultType) {
    case FaultType.Employee:
      return fault.employeeName ?? EMPTY
    case FaultType.Department:
      return fault.departmentName ?? EMPTY
    case FaultType.External:
      return fault.externalPartyName ?? EMPTY
    default: {
      const exhaustive: never = fault.faultType
      return exhaustive
    }
  }
}

function faultLabel(faultType: EmotiveClaimFaultItem['faultType']): string {
  switch (faultType) {
    case FaultType.Department:
      return m.emotive_claims_create_fault_type_department()
    case FaultType.Employee:
      return m.emotive_claims_create_fault_type_employee()
    case FaultType.External:
      return m.emotive_claims_create_fault_type_external()
    default: {
      const exhaustive: never = faultType
      return exhaustive
    }
  }
}
