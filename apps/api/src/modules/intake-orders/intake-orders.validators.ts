import { z } from 'zod'

export {
  IntakeNumberCheckQuerySchema,
  IntakeNumberCheckResponseSchema,
  IntakeNumberCheckStatus,
  IntakeOrderChangeStatusInputSchema,
  IntakeOrderCreateInputSchema,
  IntakeOrderDetailSchema,
  IntakeOrderListQuerySchema,
  IntakeOrderListResponseSchema,
  IntakeOrderSignInputSchema,
  IntakeOrderSummarySchema,
  IntakeOrderUpdateInputSchema,
  IntakePlateLookupQuerySchema,
  IntakePlateLookupResponseSchema,
  type IntakeNumberCheckQuery,
  type IntakeNumberCheckResponse,
  type IntakeOrderChangeStatusInput,
  type IntakeOrderCreateInput,
  type IntakeOrderDetail,
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
