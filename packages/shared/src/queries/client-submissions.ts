import { fetchJson } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import type { ClientSubmissionCreateInput } from '../schemas/client-submission.schema.js'

/**
 * Portal client submits a lightweight ticket (reason + attachments follow) for
 * their linked firm. Returns the new submission id so the caller can attach files.
 */
export async function createClientSubmission(
  input: ClientSubmissionCreateInput,
): Promise<{ id: string }> {
  return fetchJson<{ id: string }>('/api/client-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/**
 * Uploads one file to a submission the client owns. The API accepts the `file`
 * multipart field (see `readUploadFiles`); the browser sets the multipart
 * boundary, so no Content-Type header is passed here.
 */
export async function uploadClientSubmissionAttachment(
  submissionId: string,
  file: File,
): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  await fetchNoContent(`/api/client-submissions/${submissionId}/attachments`, {
    method: 'POST',
    body: formData,
  })
}
