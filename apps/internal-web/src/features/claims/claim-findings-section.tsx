import { ApiError } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { useEffect, useState } from 'react'

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

  useEffect(() => {
    setNotesInput(internalNotes ?? '')
  }, [internalNotes])

  const handleSave = (): void => {
    setSaveError(null)
    const trimmed = notesInput.trim()
    void onSave(trimmed === '' ? null : trimmed).catch((error: unknown) => {
      setSaveError(resolveFindingsSaveError(error))
    })
  }

  const showReadOnlyEmpty = !canEdit && (internalNotes === null || internalNotes.trim() === '')

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <Heading level="h3" as="h2" id="claimFindingsHeading" className="text-foreground">
        {m.emotive_claims_detail_section_notes()}
      </Heading>

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
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}

          <div>
            <Button type="button" onClick={handleSave} loading={isSaving}>
              {m.emotive_claims_detail_basic_save()}
            </Button>
          </div>
        </div>
      ) : showReadOnlyEmpty ? (
        <p className="text-sm text-muted-foreground">{m.emotive_claims_detail_notes_empty()}</p>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground">{internalNotes}</p>
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
