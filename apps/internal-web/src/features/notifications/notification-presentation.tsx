import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  NotificationCatalog,
  NotificationEntityType,
  NotificationType,
  type ClaimDetailSearch,
  type NotificationItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { FilePlus, Inbox, RefreshCw, User, type LucideIcon } from 'lucide-react'

import { OUTCOME_LABELS } from '~/components/outcome-pill'

/**
 * One place that turns a notification row into what the UI shows — icon, title,
 * eyebrow, accent and where a click goes. The panel and the popups both read it,
 * so the two can never drift apart.
 */

const ICON_BY_TYPE: Record<NotificationType, LucideIcon> = {
  [NotificationType.NewSubmission]: Inbox,
  [NotificationType.OutcomeChanged]: RefreshCw,
  [NotificationType.ClaimCreated]: FilePlus,
  [NotificationType.AssignedToMe]: User,
  [NotificationType.CatalogAdded]: FilePlus,
}

export function notificationIcon(type: NotificationType): LucideIcon {
  return ICON_BY_TYPE[type]
}

const EYEBROW_BY_TYPE: Record<NotificationType, () => string> = {
  [NotificationType.NewSubmission]: m.notifications_eyebrow_new_submission,
  [NotificationType.OutcomeChanged]: m.notifications_eyebrow_outcome_changed,
  [NotificationType.ClaimCreated]: m.notifications_eyebrow_claim_created,
  [NotificationType.AssignedToMe]: m.notifications_eyebrow_assigned_to_me,
  [NotificationType.CatalogAdded]: m.notifications_eyebrow_catalog_added,
}

export function notificationEyebrow(type: NotificationType): string {
  return EYEBROW_BY_TYPE[type]()
}

const CATALOG_LABEL: Record<NotificationCatalog, () => string> = {
  [NotificationCatalog.EngineTypes]: m.notifications_catalog_engine_types,
  [NotificationCatalog.EngineManufacturers]: m.notifications_catalog_engine_manufacturers,
  [NotificationCatalog.Customers]: m.notifications_catalog_customers,
}

const DASH = '—'

/** Localized one-line title. Missing data degrades to a dash rather than blowing up. */
export function notificationTitle(item: NotificationItem): string {
  const mrNumber = item.data.mrNumber ?? DASH
  const customerName = item.data.customerName ?? DASH

  switch (item.type) {
    case NotificationType.NewSubmission:
      return m.notifications_title_new_submission({ customerName })
    case NotificationType.OutcomeChanged: {
      const outcome = item.data.outcome
      return m.notifications_title_outcome_changed({
        mrNumber,
        outcome: outcome === null || outcome === undefined ? DASH : OUTCOME_LABELS[outcome](),
      })
    }
    case NotificationType.ClaimCreated:
      return m.notifications_title_claim_created({ mrNumber })
    case NotificationType.AssignedToMe:
      return m.notifications_title_assigned_to_me({ mrNumber })
    case NotificationType.CatalogAdded: {
      const catalog = item.data.catalog
      return m.notifications_title_catalog_added({
        catalog: catalog === null || catalog === undefined ? DASH : CATALOG_LABEL[catalog](),
        itemName: item.data.itemName ?? DASH,
      })
    }
    default:
      return assertNever(item.type)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled notification type: ${String(value)}`)
}

export type NotificationTarget =
  | { to: '/pristiglo/$id'; params: { id: string } }
  | { to: '/reklamacije/emotive/$id'; params: { id: string }; search: ClaimDetailSearch }
  | { to: '/reklamacije/domace/$id'; params: { id: string }; search: ClaimDetailSearch }

/**
 * Where a click leads, keyed on `entityType` (never inferred from the payload).
 * A catalog notification is informational — it has no screen to open, so it
 * returns null and the click only marks it read.
 */
export function notificationTarget(item: NotificationItem): NotificationTarget | null {
  switch (item.entityType) {
    case NotificationEntityType.ClientSubmission:
      return { to: '/pristiglo/$id', params: { id: item.entityId } }
    case NotificationEntityType.EmotiveClaim:
      return {
        to: '/reklamacije/emotive/$id',
        params: { id: item.entityId },
        search: CLAIM_DETAIL_DEFAULT_SEARCH,
      }
    case NotificationEntityType.DomaceClaim:
      return {
        to: '/reklamacije/domace/$id',
        params: { id: item.entityId },
        search: CLAIM_DETAIL_DEFAULT_SEARCH,
      }
    case NotificationEntityType.Catalog:
      return null
    default:
      return assertNever(item.entityType)
  }
}
