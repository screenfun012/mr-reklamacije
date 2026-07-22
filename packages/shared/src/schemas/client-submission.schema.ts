import { z } from 'zod'

import { ClientSubmissionStatus } from '../enums.js'

const clientSubmissionStatusValues = [
  ClientSubmissionStatus.Pending,
  ClientSubmissionStatus.Converted,
  ClientSubmissionStatus.Rejected,
] as const

export const ClientSubmissionCreateInputSchema = z.object({
  message: z.string().trim().min(1).max(5000),
})

export type ClientSubmissionCreateInput = z.infer<typeof ClientSubmissionCreateInputSchema>

export const ClientSubmissionRejectInputSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export type ClientSubmissionRejectInput = z.infer<typeof ClientSubmissionRejectInputSchema>

export const ClientSubmissionListItemSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  message: z.string(),
  status: z.enum(clientSubmissionStatusValues),
  attachmentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export type ClientSubmissionListItem = z.infer<typeof ClientSubmissionListItemSchema>

export const ClientSubmissionDetailSchema = ClientSubmissionListItemSchema.extend({
  linkedEmotiveClaimId: z.string().uuid().nullable(),
  rejectedReason: z.string().nullable(),
  handledAt: z.string().nullable(),
  submittedByUserId: z.string().uuid(),
})

export type ClientSubmissionDetail = z.infer<typeof ClientSubmissionDetailSchema>

/** Internal Inbox list response: `{ items, total, page, pageSize }` (docs/07 list shape). */
export const ClientSubmissionListResponseSchema = z.object({
  items: z.array(ClientSubmissionListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export type ClientSubmissionListResponse = z.infer<typeof ClientSubmissionListResponseSchema>

/**
 * A submission attachment as returned by `GET /client-submissions/:id/attachments`.
 * Distinct from the claim-scoped `AttachmentListItem` — a submission attachment has no
 * claim id/kind (see the API's `SubmissionAttachmentItem`).
 */
export const ClientSubmissionAttachmentItemSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  thumbnailPath: z.string().nullable(),
  caption: z.string().nullable(),
  uploadedBy: z.string().uuid().nullable(),
  uploadedAt: z.string(),
  contentSha256: z.string(),
})

export type ClientSubmissionAttachmentItem = z.infer<typeof ClientSubmissionAttachmentItemSchema>

export const ClientSubmissionAttachmentListResponseSchema = z.object({
  items: z.array(ClientSubmissionAttachmentItemSchema),
})

export type ClientSubmissionAttachmentListResponse = z.infer<
  typeof ClientSubmissionAttachmentListResponseSchema
>
