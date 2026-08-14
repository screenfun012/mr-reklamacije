import { z } from 'zod'

export {
  IntakeDocumentKindSchema,
  IntakeNumberCheckQuerySchema,
  IntakeNumberCheckResponseSchema,
  IntakeNumberCheckStatus,
  IntakeOrderChangeStatusInputSchema,
  IntakeOrderCreateInputSchema,
  IntakeOrderDetailSchema,
  IntakeOrderHandoverInputSchema,
  IntakeOrderListQuerySchema,
  IntakeOrderListResponseSchema,
  IntakeOrderSignInputSchema,
  IntakeOrderSummarySchema,
  IntakeOrderUpdateInputSchema,
  IntakePlateLookupQuerySchema,
  IntakePlateLookupResponseSchema,
  type IntakeDocumentKind,
  type IntakeNumberCheckQuery,
  type IntakeNumberCheckResponse,
  type IntakeOrderChangeStatusInput,
  type IntakeOrderCreateInput,
  type IntakeOrderDetail,
  type IntakeOrderHandoverInput,
  type IntakeOrderHistoryEntry,
  type IntakeOrderListItem,
  type IntakeOrderListQuery,
  type IntakeOrderListResponse,
  type IntakeOrderPhoto,
  type IntakeOrderSignInput,
  type IntakeOrderSummary,
  type IntakeOrderUpdateInput,
  type IntakePlateLookupQuery,
  type IntakePlateLookupResponse,
} from '@mr/shared'

export const IntakeOrderIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type IntakeOrderIdParam = z.infer<typeof IntakeOrderIdParamSchema>

export const IntakePhotoParamSchema = z.object({
  attachmentId: z.string().uuid(),
})

export type IntakePhotoParam = z.infer<typeof IntakePhotoParamSchema>
