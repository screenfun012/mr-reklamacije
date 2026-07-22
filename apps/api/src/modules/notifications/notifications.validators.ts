import { z } from 'zod'

export {
  NotificationItemSchema,
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  NotificationSnoozeInputSchema,
  type NotificationData,
  type NotificationItem,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationSnoozeInput,
} from '@mr/shared'

export const NotificationIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type NotificationIdParam = z.infer<typeof NotificationIdParamSchema>
