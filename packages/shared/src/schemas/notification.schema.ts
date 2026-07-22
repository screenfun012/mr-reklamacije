import { z } from 'zod'

import { ClaimOutcome } from '../enums.js'
import {
  notificationCatalogValues,
  notificationEntityTypeValues,
  notificationTypeValues,
} from '../constants/notifications.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

/**
 * Everything the client needs to render a localized title without a second fetch.
 * Deliberately a small, closed set — a notification carries a label, never a
 * claim's internal data.
 */
export const NotificationDataSchema = z.object({
  mrNumber: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  outcome: z.enum(claimOutcomeValues).nullable().optional(),
  catalog: z.enum(notificationCatalogValues).nullable().optional(),
  itemName: z.string().nullable().optional(),
})

export type NotificationData = z.infer<typeof NotificationDataSchema>

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(notificationTypeValues),
  entityType: z.enum(notificationEntityTypeValues),
  entityId: z.string().uuid(),
  isRead: z.boolean(),
  /** Set while the user has postponed this notification's popup; null once it is due again. */
  snoozedUntil: z.string().nullable(),
  createdAt: z.string(),
  data: NotificationDataSchema,
})

export type NotificationItem = z.infer<typeof NotificationItemSchema>

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  unreadCount: z.number().int(),
})

export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>

export const NotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>

export const NotificationSnoozeInputSchema = z.object({
  /** Absolute moment the popup becomes due again — the client resolves the preset. */
  until: z.coerce.date(),
})

export type NotificationSnoozeInput = z.infer<typeof NotificationSnoozeInputSchema>
