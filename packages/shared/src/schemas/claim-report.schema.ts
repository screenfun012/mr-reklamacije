import { z } from 'zod'

import {
  DEFAULT_CLAIM_REPORT_CONTENT_HTML,
  MAX_CLAIM_REPORT_HTML_LENGTH,
} from '../constants/claim-report.js'
import { ClaimKind, ClaimReportStatus } from '../enums.js'

export const ClaimReportQuerySchema = z.object({
  claimKind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  claimId: z.string().uuid(),
})

export type ClaimReportQuery = z.infer<typeof ClaimReportQuerySchema>

export const ClaimReportContentJsonSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough()

export type ClaimReportContentJson = z.infer<typeof ClaimReportContentJsonSchema>

export const ClaimReportUpsertBodySchema = z.object({
  contentJson: ClaimReportContentJsonSchema,
  contentHtml: z.string().max(MAX_CLAIM_REPORT_HTML_LENGTH),
})

export type ClaimReportUpsertBody = z.infer<typeof ClaimReportUpsertBodySchema>

export const ClaimReportResponseSchema = z.object({
  id: z.string().uuid().nullable(),
  claimKind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  claimId: z.string().uuid(),
  contentJson: ClaimReportContentJsonSchema,
  contentHtml: z.string(),
  status: z.enum([ClaimReportStatus.Draft]),
  persisted: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
})

export type ClaimReportResponse = z.infer<typeof ClaimReportResponseSchema>

export function buildDefaultClaimReportResponse(
  claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
  claimId: string,
): ClaimReportResponse {
  return {
    id: null,
    claimKind,
    claimId,
    contentJson: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    contentHtml: DEFAULT_CLAIM_REPORT_CONTENT_HTML,
    status: ClaimReportStatus.Draft,
    persisted: false,
    createdAt: null,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
  }
}

export const ClaimReportImageUploadResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string().min(1),
})

export type ClaimReportImageUploadResponse = z.infer<typeof ClaimReportImageUploadResponseSchema>
