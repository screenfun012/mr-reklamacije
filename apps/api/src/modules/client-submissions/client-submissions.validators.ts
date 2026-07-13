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
