import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import { ClientSubmissionStatus } from '../enums.js'
import type {
  ClientSubmissionAttachmentListResponse,
  ClientSubmissionCreateInput,
  ClientSubmissionDetail,
  ClientSubmissionListResponse,
} from '../schemas/client-submission.schema.js'
import type {
  EmotiveClaimCreateInput,
  EmotiveClaimDetail,
} from '../schemas/emotive-claim.schema.js'

const CLIENT_SUBMISSIONS_STALE_MS = 15_000
const CLIENT_SUBMISSION_DETAIL_STALE_MS = 30_000
/** Internal Inbox lists 20 pending submissions per page (API default). */
export const CLIENT_SUBMISSIONS_PAGE_SIZE = 20

export const clientSubmissionKeys = {
  all: ['client-submissions'] as const,
  lists: () => [...clientSubmissionKeys.all, 'list'] as const,
  list: (page: number) => [...clientSubmissionKeys.lists(), { page }] as const,
  details: () => [...clientSubmissionKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientSubmissionKeys.details(), id] as const,
  attachments: (id: string) => [...clientSubmissionKeys.all, 'attachments', id] as const,
}

/** Internal Inbox: one page of pending submissions, newest first (badge reads `total`). */
export function pendingClientSubmissionsListOptions(page: number) {
  const query = new URLSearchParams({
    status: ClientSubmissionStatus.Pending,
    page: String(page),
    pageSize: String(CLIENT_SUBMISSIONS_PAGE_SIZE),
  })

  return queryOptions({
    queryKey: clientSubmissionKeys.list(page),
    queryFn: () =>
      fetchJson<ClientSubmissionListResponse>(`/api/client-submissions?${query.toString()}`),
    staleTime: CLIENT_SUBMISSIONS_STALE_MS,
    placeholderData: keepPreviousData,
  })
}

/** Internal Inbox: one submission's full detail. */
export function clientSubmissionDetailOptions(id: string) {
  return queryOptions({
    queryKey: clientSubmissionKeys.detail(id),
    queryFn: () => fetchJson<ClientSubmissionDetail>(`/api/client-submissions/${id}`),
    staleTime: CLIENT_SUBMISSION_DETAIL_STALE_MS,
  })
}

/** Internal Inbox: a submission's carried-over attachments (photos/documents). */
export function clientSubmissionAttachmentsOptions(id: string) {
  return queryOptions({
    queryKey: clientSubmissionKeys.attachments(id),
    queryFn: () =>
      fetchJson<ClientSubmissionAttachmentListResponse>(
        `/api/client-submissions/${id}/attachments`,
      ),
    staleTime: CLIENT_SUBMISSION_DETAIL_STALE_MS,
  })
}

/**
 * Converts a pending submission into an EMOTIVE claim (create + attachment carry-over +
 * status flip run atomically server-side). Returns the created claim. NOT the plain
 * `/api/emotive-claims` create endpoint — this one owns the transaction (docs/18 §7).
 */
export async function convertClientSubmission(
  id: string,
  input: EmotiveClaimCreateInput,
): Promise<EmotiveClaimDetail> {
  return fetchJson<EmotiveClaimDetail>(`/api/client-submissions/${id}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** Dismisses a pending submission with an optional internal reason (not shown to the client). */
export async function rejectClientSubmission(id: string, reason?: string): Promise<void> {
  await fetchNoContent(`/api/client-submissions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reason !== undefined && reason.length > 0 ? { reason } : {}),
  })
}

/** Inline/download URL for one submission attachment (streamed, nosniff, Content-Disposition). */
export function buildClientSubmissionAttachmentDownloadUrl(
  submissionId: string,
  attachmentId: string,
  disposition: 'inline' | 'attachment' = 'inline',
): string {
  const base = `/api/client-submissions/${submissionId}/attachments/${attachmentId}/download`
  return disposition === 'attachment' ? `${base}?disposition=attachment` : base
}

/** Grid-sized thumbnail for a submission attachment (server falls back to the original). */
export function buildClientSubmissionAttachmentThumbnailUrl(
  submissionId: string,
  attachmentId: string,
): string {
  return `/api/client-submissions/${submissionId}/attachments/${attachmentId}/download?variant=thumbnail`
}

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
