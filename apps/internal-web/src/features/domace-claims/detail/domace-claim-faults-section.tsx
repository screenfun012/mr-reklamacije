import {
  ApiError,
  departmentsReferenceOptions,
  employeesReferenceOptions,
  externalPartiesReferenceOptions,
  FaultType,
  type DomaceClaimDetail,
  type DomaceClaimFaultItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

import {
  formatZodFieldErrors,
  validateFaultDrafts,
  type DomaceClaimFaultDraft,
} from '../create/domace-claim-create-schemas.js'
import { faultDraftsToInput, faultItemToDraft } from '../../emotive-claims/faults/fault-draft.js'
import { FaultRowsEditor } from '../../emotive-claims/faults/fault-rows-editor.js'
import { useUpdateDomaceClaimFaults } from './use-update-domace-claim-faults.js'

const EMPTY = '—'

interface DomaceClaimFaultsSectionProps {
  claim: DomaceClaimDetail
  canEdit: boolean
}

export function DomaceClaimFaultsSection({
  claim,
  canEdit,
}: DomaceClaimFaultsSectionProps): React.ReactElement {
  const [editing, setEditing] = useState(false)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
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

function FaultsReadOnly({ faults }: { faults: DomaceClaimFaultItem[] }): React.ReactElement {
  if (faults.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.emotive_claims_detail_faults_empty()}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-2 font-medium text-muted-foreground">
              {m.emotive_claims_create_fault_type()}
            </th>
            <th className="px-4 py-2 font-medium text-muted-foreground">
              {m.emotive_claims_create_review_fault_target()}
            </th>
            <th className="px-4 py-2 font-medium text-muted-foreground">
              {m.emotive_claims_detail_fault_notes()}
            </th>
          </tr>
        </thead>
        <tbody>
          {faults.map((fault) => (
            <tr key={fault.id} className="border-t border-border">
              <td className="px-4 py-2">{faultLabel(fault.faultType)}</td>
              <td className="px-4 py-2">{resolveFaultTarget(fault)}</td>
              <td className="px-4 py-2 text-muted-foreground">{fault.notes ?? EMPTY}</td>
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
  claim: DomaceClaimDetail
  onDone: () => void
}): React.ReactElement {
  const { data: departments } = useSuspenseQuery(departmentsReferenceOptions({ activeOnly: true }))
  const { data: employees } = useSuspenseQuery(employeesReferenceOptions({ activeOnly: true }))
  const { data: externalParties } = useSuspenseQuery(
    externalPartiesReferenceOptions({ activeOnly: true }),
  )

  const [drafts, setDrafts] = useState<DomaceClaimFaultDraft[]>(() =>
    claim.faults.map(faultItemToDraft),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const mutation = useUpdateDomaceClaimFaults(claim.id)

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
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending
            ? m.emotive_claims_detail_faults_saving()
            : m.emotive_claims_detail_faults_save()}
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

function resolveFaultTarget(fault: DomaceClaimFaultItem): string {
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

function faultLabel(faultType: DomaceClaimFaultItem['faultType']): string {
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
