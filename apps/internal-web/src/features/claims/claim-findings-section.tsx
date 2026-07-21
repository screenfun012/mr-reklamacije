import { ApiError, type Finding } from '@mr/shared'
import { m } from '@mr/i18n'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalFieldGroup } from '~/components/internal-field-group'
import { InternalInput } from '~/components/internal-field'

import { TEXTAREA_FIELD_CLASS } from '../emotive-claims/create/form-field-styles.js'

const FINDING_TYPE_MAX_LENGTH = 80

interface ClaimFindingsSectionProps {
  findings: Finding[]
  canEdit: boolean
  isSaving: boolean
  onSave: (findings: Finding[]) => Promise<unknown>
}

/**
 * Multi-row findings editor shared by both claim kinds (mirrors the fault-rows
 * editor). A finding is free text plus an operator-typed type tag; the whole
 * list is replaced on save.
 */
export function ClaimFindingsSection({
  findings,
  canEdit,
  isSaving,
  onSave,
}: ClaimFindingsSectionProps): React.ReactElement {
  const [draft, setDraft] = useState<Finding[]>(findings)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Compared as a signature, not by reference: the detail query hands us a new
  // array on every refetch, and a reference check would wipe the draft mid-edit.
  const serverSignature = JSON.stringify(findings)
  const lastSyncedRef = useRef(serverSignature)

  useEffect(() => {
    if (isSaving || serverSignature === lastSyncedRef.current) {
      return
    }

    lastSyncedRef.current = serverSignature
    setDraft(findings)
  }, [findings, serverSignature, isSaving])

  const replaceAt = (index: number, next: Finding): void => {
    setDraft(draft.map((finding, i) => (i === index ? next : finding)))
  }

  const handleSave = (): void => {
    setSaveError(null)
    const cleaned = draft
      .map((finding) => ({ text: finding.text.trim(), type: finding.type.trim() }))
      .filter((finding) => finding.text !== '')
    setDraft(cleaned)
    lastSyncedRef.current = JSON.stringify(cleaned)
    void onSave(cleaned).catch((error: unknown) => {
      lastSyncedRef.current = serverSignature
      setSaveError(resolveFindingsSaveError(error))
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <h2 id="claimFindingsHeading" className="text-[15px] font-extrabold text-mri-text">
        {m.emotive_claims_detail_section_notes()}
      </h2>

      {canEdit ? (
        <div className="flex flex-col gap-4">
          {draft.map((finding, index) => (
            <div
              key={`finding-${index}`}
              className="flex flex-col gap-3 rounded-[13px] border border-mri-border bg-mri-inbg/40 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mri-redh">
                  {m.claims_findings_row_title({ index: index + 1 })}
                </p>
                <InternalButton
                  type="button"
                  variant="ghost"
                  className="h-8 w-auto gap-1.5 px-2 text-[11.5px]"
                  disabled={isSaving}
                  onClick={() => setDraft(draft.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {m.claims_findings_remove()}
                </InternalButton>
              </div>

              <InternalFieldGroup id={`finding-type-${index}`} label={m.claims_findings_type()}>
                <InternalInput
                  id={`finding-type-${index}`}
                  value={finding.type}
                  disabled={isSaving}
                  maxLength={FINDING_TYPE_MAX_LENGTH}
                  onChange={(event) => replaceAt(index, { ...finding, type: event.target.value })}
                />
              </InternalFieldGroup>

              <InternalFieldGroup id={`finding-text-${index}`} label={m.claims_findings_text()}>
                <textarea
                  id={`finding-text-${index}`}
                  className={TEXTAREA_FIELD_CLASS}
                  value={finding.text}
                  disabled={isSaving}
                  onChange={(event) => replaceAt(index, { ...finding, text: event.target.value })}
                />
              </InternalFieldGroup>
            </div>
          ))}

          <InternalButton
            type="button"
            variant="dashed"
            className="h-[46px] w-full text-[13px]"
            disabled={isSaving}
            onClick={() => setDraft([...draft, { text: '', type: '' }])}
          >
            <Plus className="size-4" aria-hidden="true" />
            {m.claims_findings_add()}
          </InternalButton>

          {saveError ? (
            <p className="text-sm text-mri-bad" role="alert">
              {saveError}
            </p>
          ) : null}

          <div>
            <InternalButton
              type="button"
              variant="green"
              className="h-10 w-auto px-5 text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              <span aria-hidden="true" className="font-normal">
                ✓
              </span>{' '}
              {m.emotive_claims_detail_basic_save()}
            </InternalButton>
          </div>
        </div>
      ) : findings.length === 0 ? (
        <p className="text-sm text-mri-text2">{m.emotive_claims_detail_notes_empty()}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {findings.map((finding, index) => (
            <li
              key={`finding-${index}`}
              className="flex flex-col gap-1.5 rounded-[13px] border border-mri-border bg-mri-inbg/40 p-4"
            >
              {finding.type !== '' ? (
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mri-redh">
                  {finding.type}
                </span>
              ) : null}
              <p className="text-sm whitespace-pre-wrap text-mri-text">{finding.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function resolveFindingsSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return m.emotive_claims_detail_basic_save_error()
}
