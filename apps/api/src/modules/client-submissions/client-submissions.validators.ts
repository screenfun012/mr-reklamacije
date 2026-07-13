import { ClientSubmissionStatus } from '@mr/shared'
import { z } from 'zod'

export {
  ClientSubmissionCreateInputSchema,
  ClientSubmissionRejectInputSchema,
  ClientSubmissionListItemSchema,
  ClientSubmissionDetailSchema,
  type ClientSubmissionCreateInput,
  type ClientSubmissionRejectInput,
  type ClientSubmissionListItem,
  type ClientSubmissionDetail,
} from '@mr/shared'

export const ClientSubmissionIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ClientSubmissionIdParam = z.infer<typeof ClientSubmissionIdParamSchema>

/**
 * Inbox list query. v1 lists only `pending` submissions (the repository's single read);
 * `status` is accepted so the wire matches `?status=pending` and rejects other values until
 * the Inbox surfaces converted/rejected history.
 */
export const ClientSubmissionListQuerySchema = z.object({
  status: z.literal(ClientSubmissionStatus.Pending).default(ClientSubmissionStatus.Pending),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export type ClientSubmissionListQuery = z.infer<typeof ClientSubmissionListQuerySchema>
