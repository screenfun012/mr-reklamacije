import {
  SYSTEM_ROLE_ADMIN,
  UserAccountStatus,
  NotificationEntityType,
  NotificationType,
  type Permission,
} from '@mr/shared'
import { inArray, and, count, desc, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  employees,
  notifications,
  rolePermissions,
  roles,
  userRoles,
  users,
} from './notifications.schema.js'
import type { CreatedNotification, NotificationInsert } from './notifications.types.js'
import type { NotificationItem, NotificationListQuery } from './notifications.validators.js'

interface NotificationRow {
  id: string
  type: NotificationItem['type']
  entityType: NotificationItem['entityType']
  entityId: string
  data: NotificationItem['data']
  isRead: boolean
  snoozedUntil: Date | null
  createdAt: Date
}

function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    entityType: row.entityType,
    entityId: row.entityId,
    data: row.data,
    isRead: row.isRead,
    snoozedUntil: row.snoozedUntil === null ? null : row.snoozedUntil.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

/** Only a live, approved account can receive a notification (mirrors the login gate). */
function isNotifiableUser() {
  return and(
    eq(users.isActive, true),
    eq(users.accountStatus, UserAccountStatus.Approved),
    isNull(users.deletedAt),
  )
}

export class NotificationsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(
    userId: string,
    query: NotificationListQuery,
  ): Promise<{ items: NotificationItem[]; total: number; unreadCount: number }> {
    const [rows, [totalRow], [unreadRow]] = await Promise.all([
      this.db
        .select({
          id: notifications.id,
          type: notifications.type,
          entityType: notifications.entityType,
          entityId: notifications.entityId,
          data: notifications.data,
          isRead: notifications.isRead,
          snoozedUntil: notifications.snoozedUntil,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(eq(notifications.userId, userId)),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
    ])

    return {
      items: rows.map(mapNotificationRow),
      total: totalRow?.value ?? 0,
      unreadCount: unreadRow?.value ?? 0,
    }
  }

  /**
   * Idempotent: re-reading an already-read row keeps the original `read_at`.
   * Returns false when the row does not exist OR belongs to someone else — the
   * caller turns that into a 404 so a foreign id never leaks its existence.
   */
  async markRead(userId: string, id: string): Promise<boolean> {
    const updated = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: sql`COALESCE(${notifications.readAt}, now())`,
      })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id })

    return updated.length > 0
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: sql`COALESCE(${notifications.readAt}, now())` })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
  }

  /** Snoozing postpones the popup only — the row deliberately stays unread. */
  async snooze(userId: string, id: string, until: Date): Promise<boolean> {
    const updated = await this.db
      .update(notifications)
      .set({ snoozedUntil: until })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id })

    return updated.length > 0
  }

  /**
   * Removes one of the caller's own rows. Returns false when the row does not
   * exist OR belongs to someone else (→ 404). Because the inbox is one row per
   * recipient, this only clears it from this user's bell; others keep theirs.
   */
  async deleteOwn(userId: string, id: string): Promise<boolean> {
    const removed = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id })

    return removed.length > 0
  }

  /** Clears the caller's whole inbox — their rows only. */
  async deleteAllOwn(userId: string): Promise<void> {
    await this.db.delete(notifications).where(eq(notifications.userId, userId))
  }

  async insertMany(rows: readonly NotificationInsert[]): Promise<CreatedNotification[]> {
    if (rows.length === 0) {
      return []
    }

    return this.db
      .insert(notifications)
      .values(
        rows.map((row) => ({
          userId: row.userId,
          type: row.type,
          entityType: row.entityType,
          entityId: row.entityId,
          data: row.data,
        })),
      )
      .returning({ id: notifications.id, userId: notifications.userId })
  }

  /**
   * Removes every notification pointing at one entity — used when a client
   * submission is handled, so the "new submission" rows are replaced by the
   * outcome notification rather than lingering as unread work. Returns the user
   * ids whose inbox changed, so their bells can be refreshed over SSE.
   */
  async deleteByEntity(entityType: NotificationEntityType, entityId: string): Promise<string[]> {
    const removed = await this.db
      .delete(notifications)
      .where(and(eq(notifications.entityType, entityType), eq(notifications.entityId, entityId)))
      .returning({ userId: notifications.userId })

    return [...new Set(removed.map((row) => row.userId))]
  }

  /**
   * Everyone who effectively holds `permission`, minus the actor.
   *
   * The `admin` role is matched by role CODE, not by `role_permissions`: the permission
   * resolver hard-codes `ADMIN_PERMISSIONS` for admins (packages/auth `permissions.ts`), so
   * an admin may legitimately have zero junction rows and a plain join would silently skip
   * them. Mirroring the resolver here keeps fan-out and authorization in agreement.
   */
  async findRecipientsWithPermission(
    permission: Permission,
    excludeUserId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(
        rolePermissions,
        and(eq(rolePermissions.roleId, roles.id), eq(rolePermissions.permissionId, permission)),
      )
      .where(
        and(
          isNotifiableUser(),
          ne(users.id, excludeUserId),
          isNull(roles.deletedAt),
          or(eq(roles.code, SYSTEM_ROLE_ADMIN), isNotNull(rolePermissions.permissionId)),
        ),
      )

    return rows.map((row) => row.id)
  }

  /** Forgets every notification pointing at any of these chat messages. */
  async deleteForChatMessages(messageIds: readonly string[]): Promise<void> {
    if (messageIds.length === 0) {
      return
    }

    await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.entityType, NotificationEntityType.ChatMessage),
          inArray(notifications.entityId, [...messageIds]),
        ),
      )
  }

  /**
   * Who already has a mention notification for this message.
   *
   * An edit inside the 15-minute window may ADD a mention, and that must ring — but the people the
   * first version already named must not hear it twice. The notification rows ARE that record, so
   * there is no second table to keep in step with them.
   */
  async findMentionRecipients(messageId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(
        and(
          eq(notifications.entityType, NotificationEntityType.ChatMessage),
          eq(notifications.entityId, messageId),
          eq(notifications.type, NotificationType.ChatMention),
        ),
      )

    return [...new Set(rows.map((row) => row.userId))]
  }

  /** The account behind an employee record, or null when nobody is linked / it is the actor. */
  async findEmployeeUserId(employeeId: string, excludeUserId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(employees)
      .innerJoin(users, eq(users.id, employees.userId))
      .where(
        and(
          eq(employees.id, employeeId),
          isNull(employees.deletedAt),
          isNotifiableUser(),
          ne(users.id, excludeUserId),
        ),
      )
      .limit(1)

    return row?.id ?? null
  }
}
