import { ApiError } from '@mr/shared'
import { m } from '@mr/i18n'
import { useEffect, useRef, useState } from 'react'

import { InternalButton } from '~/components/internal-button'

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
    <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <h2 id={headingId} className="text-[15px] font-extrabold text-mri-text">
        {heading}
      </h2>
      {hint !== undefined ? <p className="text-xs text-mri-text2">{hint}</p> : null}

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
        <p className="text-sm italic text-mri-text2">{emptyText}</p>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-mri-text">{value}</p>
      )}
    </section>
  )
}
