import { AttachmentVisibility, ClaimKind } from '../enums.js'
import { z } from 'zod'

export const AttachmentListQuerySchema = z.object({
  claimKind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  claimId: z.string().uuid(),
})

export type AttachmentListQuery = z.infer<typeof AttachmentListQuerySchema>

export const AttachmentUploadVisibilitySchema = z.enum([
  AttachmentVisibility.Internal,
  AttachmentVisibility.ClientVisible,
])

export const AttachmentListItemSchema = z.object({
  id: z.string().uuid(),
  claimKind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  claimId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  thumbnailPath: z.string().nullable(),
  caption: z.string().nullable(),
  visibility: z.enum([AttachmentVisibility.Internal, AttachmentVisibility.ClientVisible]),
  uploadedBy: z.string().uuid().nullable(),
  uploadedAt: z.string(),
  contentSha256: z.string(),
})

export type AttachmentListItem = z.infer<typeof AttachmentListItemSchema>

export const AttachmentListResponseSchema = z.object({
  items: z.array(AttachmentListItemSchema),
})

export type AttachmentListResponse = z.infer<typeof AttachmentListResponseSchema>

export const AttachmentSignedUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
})

export type AttachmentSignedUrlResponse = z.infer<typeof AttachmentSignedUrlResponseSchema>

export const AttachmentUploadResultSchema = z.object({
  items: z.array(AttachmentListItemSchema),
  skippedDuplicates: z.number().int().nonnegative(),
})

export type AttachmentUploadResult = z.infer<typeof AttachmentUploadResultSchema>
