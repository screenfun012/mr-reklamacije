import { ApiError } from '@mr/shared'
import { m } from '@mr/i18n'
import { InternalButton } from '~/components/internal-button'
import { useEffect, useRef, useState } from 'react'

import { TEXTAREA_FIELD_CLASS } from '../emotive-claims/create/form-field-styles.js'

interface ClaimFindingsSectionProps {
  internalNotes: string | null
  canEdit: boolean
  isSaving: boolean
  onSave: (internalNotes: string | null) => Promise<unknown>
}

export function ClaimFindingsSection({
  internalNotes,
  canEdit,
  isSaving,
  onSave,
}: ClaimFindingsSectionProps): React.ReactElement {
  const [notesInput, setNotesInput] = useState(() => internalNotes ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const lastSyncedNotesRef = useRef(internalNotes)

  useEffect(() => {
    if (isSaving) {
      return
    }

    if (internalNotes === lastSyncedNotesRef.current) {
      return
    }

    lastSyncedNotesRef.current = internalNotes
    setNotesInput(internalNotes ?? '')
  }, [internalNotes, isSaving])

  const handleSave = (): void => {
    setSaveError(null)
    const trimmed = notesInput.trim()
    const nextNotes = trimmed === '' ? null : trimmed
    lastSyncedNotesRef.current = nextNotes
    void onSave(nextNotes).catch((error: unknown) => {
      lastSyncedNotesRef.current = internalNotes
      setSaveError(resolveFindingsSaveError(error))
    })
  }

  const showReadOnlyEmpty = !canEdit && (internalNotes === null || internalNotes.trim() === '')

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <h2 id="claimFindingsHeading" className="text-[15px] font-extrabold text-mri-text">
        {m.emotive_claims_detail_section_notes()}
      </h2>

      {canEdit ? (
        <div className="flex flex-col gap-3">
          <textarea
            id="claimFindings"
            className={TEXTAREA_FIELD_CLASS}
            value={notesInput}
            aria-labelledby="claimFindingsHeading"
            onChange={(event) => setNotesInput(event.target.value)}
            disabled={isSaving}
          />

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
      ) : showReadOnlyEmpty ? (
        <p className="text-sm text-mri-text2">{m.emotive_claims_detail_notes_empty()}</p>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-mri-text">{internalNotes}</p>
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
