import { ApiError } from '@mr/shared'
import { m } from '@mr/i18n'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard } from '~/components/internal-card'

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
  /** Far right of the card header — the published badge and "Objavi klijentu" (handoff §5). */
  headerActions?: ReactNode
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
  headerActions,
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
    <InternalCard
      title={
        <span id={headingId} className="text-[14.5px] font-extrabold text-mri-text">
          {heading}
        </span>
      }
      {...(headerActions === undefined ? {} : { actions: headerActions })}
      bodyClassName="flex flex-col gap-[11px] px-[18px] py-4"
    >
      {hint === undefined ? null : <p className="text-[12px] text-mri-text2">{hint}</p>}

      {canEdit ? (
        <>
          <textarea
            id={textareaId}
            className={TEXTAREA_FIELD_CLASS}
            value={input}
            aria-labelledby={headingId}
            onChange={(event) => setInput(event.target.value)}
            disabled={isSaving}
          />

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
        </>
      ) : showReadOnlyEmpty ? (
        <p className="text-[12.5px] italic text-mri-text2">{emptyText}</p>
      ) : (
        <p className="whitespace-pre-wrap text-[13px] text-mri-text">{value}</p>
      )}
    </InternalCard>
  )
}
