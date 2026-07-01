import { ApiError } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { useEffect, useRef, useState } from 'react'

import { TEXTAREA_FIELD_CLASS } from '../emotive-claims/create/form-field-styles.js'

// Generic single-textarea claim section (edit + save), modelled on the findings
// section. Used for the client-visible inspection report; parameterised by label
// so it stays reusable without touching the findings component.
interface ClaimTextSectionProps {
  value: string | null
  heading: string
  hint?: string | undefined
  emptyText: string
  textareaId: string
  canEdit: boolean
  isSaving: boolean
  onSave: (value: string | null) => Promise<unknown>
}

export function ClaimTextSection({
  value,
  heading,
  hint,
  emptyText,
  textareaId,
  canEdit,
  isSaving,
  onSave,
}: ClaimTextSectionProps): React.ReactElement {
  const [input, setInput] = useState(() => value ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const lastSyncedRef = useRef(value)

  useEffect(() => {
    if (isSaving) {
      return
    }
    if (value === lastSyncedRef.current) {
      return
    }
    lastSyncedRef.current = value
    setInput(value ?? '')
  }, [value, isSaving])

  const headingId = `${textareaId}Heading`

  const handleSave = (): void => {
    setSaveError(null)
    const trimmed = input.trim()
    const next = trimmed === '' ? null : trimmed
    lastSyncedRef.current = next
    void onSave(next).catch((error: unknown) => {
      lastSyncedRef.current = value
      setSaveError(
        error instanceof ApiError ? error.message : m.emotive_claims_detail_basic_save_error(),
      )
    })
  }

  const showReadOnlyEmpty = !canEdit && (value === null || value.trim() === '')

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <Heading level="h3" as="h2" id={headingId} className="text-foreground">
        {heading}
      </Heading>
      {hint !== undefined ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      {canEdit ? (
        <div className="flex flex-col gap-3">
          <textarea
            id={textareaId}
            className={TEXTAREA_FIELD_CLASS}
            value={input}
            aria-labelledby={headingId}
            onChange={(event) => setInput(event.target.value)}
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
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground">{value}</p>
      )}
    </section>
  )
}
