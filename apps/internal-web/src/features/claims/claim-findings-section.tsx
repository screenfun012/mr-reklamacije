import { ApiError, type Finding } from '@mr/shared'
import { m } from '@mr/i18n'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'
import { InternalFieldGroup } from '~/components/internal-field-group'
import { InternalInput } from '~/components/internal-field'

import { TEXTAREA_FIELD_CLASS } from '../emotive-claims/create/form-field-styles.js'

const FINDING_TYPE_MAX_LENGTH = 80

interface ClaimFindingsSectionProps {
  findings: Finding[]
  canEdit: boolean
  isSaving: boolean
  onSave: (findings: Finding[]) => Promise<unknown>
  /** Section heading — DOMACE calls it "Napomena" to match its Excel; defaults to the EMOTIVE label. */
  title?: string
}

/**
 * The Nalazi tab (handoff §5): the shop's own notes on what it found, one card per finding,
 * ONE green save at the bottom. It is the "interna kuhinja" — what the client is eventually
 * told is written from these, on the Izveštaj tab, and never from here.
 */
export function ClaimFindingsSection({
  findings,
  canEdit,
  isSaving,
  onSave,
  title,
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
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-[11px]">
      <p className="text-[12px] text-mri-text2">{m.claim_detail_findings_hint()}</p>

      <InternalCard title={title ?? m.emotive_claims_detail_section_notes()}>
        {canEdit ? (
          <div className="flex flex-col gap-[13px]">
            {draft.map((finding, index) => (
              <div
                key={`finding-${index}`}
                className="flex flex-col gap-[11px] rounded-xl border border-mri-border2 p-[15px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-mri-red">
                    {m.claims_findings_row_title({ index: index + 1 })}
                  </p>
                  <InternalButton
                    type="button"
                    variant="ghost"
                    className="h-7 w-auto gap-1.5 px-1.5 font-mono text-[9px] tracking-[0.1em]"
                    disabled={isSaving}
                    onClick={() => setDraft(draft.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
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

            {draft.length === 0 ? (
              <p className="text-[12.5px] italic text-mri-text2">
                {m.claim_detail_findings_empty_hint()}
              </p>
            ) : null}

            <InternalButton
              type="button"
              variant="dashed"
              className="h-11 w-full text-[12px] uppercase tracking-[0.06em]"
              disabled={isSaving}
              onClick={() => setDraft([...draft, { text: '', type: '' }])}
            >
              <Plus className="size-4" aria-hidden="true" />
              {m.claims_findings_add()}
            </InternalButton>

            {saveError ? (
              <p className="text-[13px] text-mri-bad" role="alert">
                {saveError}
              </p>
            ) : null}

            <div className="flex justify-end">
              <InternalButton
                type="button"
                variant="green"
                className="h-10 w-auto px-5 text-[11.5px] tracking-[0.06em]"
                onClick={handleSave}
                disabled={isSaving}
              >
                <span aria-hidden="true" className="font-normal">
                  ✓
                </span>
                {m.emotive_claims_detail_basic_save()}
              </InternalButton>
            </div>
          </div>
        ) : findings.length === 0 ? (
          <p className="text-[12.5px] italic text-mri-text2">
            {m.emotive_claims_detail_notes_empty()}
          </p>
        ) : (
          <ul className="flex flex-col gap-[13px]">
            {findings.map((finding, index) => (
              <li
                key={`finding-${index}`}
                className="flex flex-col gap-1.5 rounded-xl border border-mri-border2 p-[15px]"
              >
                {finding.type !== '' ? (
                  <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-mri-red">
                    {finding.type}
                  </span>
                ) : null}
                <p className="whitespace-pre-wrap text-[13px] text-mri-text">{finding.text}</p>
              </li>
            ))}
          </ul>
        )}
      </InternalCard>
    </div>
  )
}

export function resolveFindingsSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return m.emotive_claims_detail_basic_save_error()
}
