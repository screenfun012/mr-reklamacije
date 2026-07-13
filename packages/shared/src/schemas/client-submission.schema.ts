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
