import { useState } from 'react'

import { m } from '@mr/i18n'
import {
  createClientSubmission,
  formatFieldError,
  uploadClientSubmissionAttachment,
} from '@mr/shared'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { PortalButton } from '~/components/portal-button'
import { PortalFieldError, PortalLabel, PortalTextarea } from '~/components/portal-field'
import { showPortalToast } from '~/lib/portal-toast'

import { AttachmentPicker } from './attachment-picker'

/**
 * "Prijavi problem" form: a required reason (razlog → the claim's GREŠKA on
 * conversion) plus optional attachments. On submit it creates the submission,
 * then uploads each file to it, confirms with a toast, and returns to /claims.
 * No optimistic update — the server is the single source of truth.
 */
export function ReportForm() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<readonly File[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Built here (not at module scope) so the validation message uses the live
  // locale; the root remounts on locale switch, giving useForm a fresh schema.
  // Matches the server-side `ClientSubmissionCreateInputSchema` (min 1, max 5000).
  const reportSchema = z.object({
    message: z.string().trim().min(1, m.portal_submit_reason_required()).max(5000),
  })

  const form = useForm({
    defaultValues: { message: '' },
    validators: {
      onChange: reportSchema,
      onSubmit: reportSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setIsPending(true)
      try {
        const { id } = await createClientSubmission({ message: value.message.trim() })
        for (const file of files) {
          await uploadClientSubmissionAttachment(id, file)
        }
        showPortalToast(m.portal_submit_success())
        await navigate({ to: '/claims' })
      } catch (err) {
        console.error('[report] submission failed:', err)
        setSubmitError(m.portal_submit_error())
        setIsPending(false)
      }
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      noValidate
    >
      <form.Field
        name="message"
        children={(field) => (
          <div className="mb-6">
            <PortalLabel htmlFor="message">{m.portal_submit_reason_label()}</PortalLabel>
            <PortalTextarea
              id="message"
              maxLength={5000}
              placeholder={m.portal_submit_reason_placeholder()}
              value={field.state.value}
              onChange={(event) => {
                field.handleChange(event.target.value)
              }}
              onBlur={field.handleBlur}
              disabled={isPending}
            />
            {field.state.meta.errors.length > 0 && (
              <PortalFieldError>{formatFieldError(field.state.meta.errors[0])}</PortalFieldError>
            )}
          </div>
        )}
      />

      <div className="mb-7">
        <PortalLabel htmlFor="attachments">{m.portal_submit_attachments_label()}</PortalLabel>
        <AttachmentPicker files={files} onChange={setFiles} disabled={isPending} />
      </div>

      {submitError !== null && (
        <div
          role="alert"
          className="mb-5 rounded-[10px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg p-3 text-sm text-mrp-bad"
        >
          {submitError}
        </div>
      )}

      <PortalButton type="submit" disabled={isPending}>
        {isPending ? m.portal_submit_submitting() : m.portal_submit_button()}
        {!isPending && <span className="font-normal">→</span>}
      </PortalButton>
    </form>
  )
}
