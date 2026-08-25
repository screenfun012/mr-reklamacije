import { and, desc, eq, gt, inArray, ne, sql } from 'drizzle-orm'
import { schema } from '@mr/db'
import {
  MAX_ACTIVE_SESSIONS_PER_USER,
  PushSubscriptionMode,
  type PushSubscriptionMode as Mode,
} from '@mr/shared'

import type { ApiDatabase } from '../../core/database.js'

import { pushSubscriptions } from './push.schema.js'

const sessions = schema.sessions
const users = schema.users

/** One browser to send to. Nothing here is shown to anybody — it is all transport. */
export interface StoredPushSubscription {
  readonly id: string
  readonly userId: string
  readonly sessionId: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly mode: PushSubscriptionMode
}

export interface PushSubscriptionInput {
  readonly userId: string
  readonly sessionId: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly userAgent: string | null
}

export class PushRepository {
  constructor(private readonly db: ApiDatabase) {}

  /**
   * Records a browser's agreement to be told — or hands the device over to whoever is holding it.
   *
   * ⚠ `ON CONFLICT (endpoint)` rather than a plain insert. The same browser on the same device
   * hands back the same endpoint every time, so a second person signing in there must INHERIT the
   * row: two rows would leave the previous user receiving the shop's messages on a device that is
   * no longer theirs, and there is nothing on the phone that would ever reveal it.
   *
   * One live session owns one endpoint. A new endpoint replaces its former endpoint, while a global
   * endpoint conflict transfers the browser to the current account with THAT account's mode.
   */
  async subscribe(input: PushSubscriptionInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      // One user-row lock serialises rebind with their privacy-mode change on every API replica.
      const preference = await tx.execute<{ pushMode: Mode | null; legacyMode: Mode | null }>(sql`
        SELECT
          ${users.pushMode} AS "pushMode",
          (
            SELECT CASE
              WHEN BOOL_OR(${pushSubscriptions.mode} = ${PushSubscriptionMode.NoText})
                THEN ${PushSubscriptionMode.NoText}
              WHEN BOOL_OR(${pushSubscriptions.mode} = ${PushSubscriptionMode.Mentions})
                THEN ${PushSubscriptionMode.Mentions}
              ELSE ${PushSubscriptionMode.All}
            END
            FROM ${pushSubscriptions}
            WHERE ${pushSubscriptions.userId} = ${input.userId}
          ) AS "legacyMode"
        FROM ${users}
        WHERE ${users.id} = ${input.userId}
        FOR UPDATE
      `)
      const preferenceRow = preference.rows[0]
      if (preferenceRow === undefined) {
        throw new Error('Authenticated push user does not exist')
      }
      const mode = preferenceRow.pushMode ?? preferenceRow.legacyMode ?? PushSubscriptionMode.All
      if (preferenceRow.pushMode === null) {
        await tx.update(users).set({ pushMode: mode }).where(eq(users.id, input.userId))
      }

      // Also serialise two refreshes of the same session and reject an impossible owner mismatch.
      const lockedSession = await tx.execute<{ id: string }>(
        sql`SELECT ${sessions.id} AS id FROM ${sessions}
            WHERE ${sessions.id} = ${input.sessionId}
              AND ${sessions.userId} = ${input.userId}
            FOR UPDATE`,
      )
      if (lockedSession.rows[0] === undefined) {
        throw new Error('Authenticated push session does not belong to its user')
      }

      // A cold app load re-posts the same valid subscription so it can repair server state. Keep
      // that normal path to one UPSERT; only remove a row when this session really changed endpoint.
      await tx
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.sessionId, input.sessionId),
            ne(pushSubscriptions.endpoint, input.endpoint),
          ),
        )

      await tx
        .insert(pushSubscriptions)
        .values({
          userId: input.userId,
          sessionId: input.sessionId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
          mode,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: input.userId,
            sessionId: input.sessionId,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: input.userAgent,
            mode,
          },
        })
    })
  }

  /** Everything to send to, for a whole fan-out at once. */
  async listForUsers(userIds: readonly string[]): Promise<StoredPushSubscription[]> {
    const ids = [...new Set(userIds)]
    if (ids.length === 0) {
      return []
    }

    const rows = await this.db
      .select({
        id: pushSubscriptions.id,
        userId: pushSubscriptions.userId,
        sessionId: pushSubscriptions.sessionId,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        mode: sql<Mode>`COALESCE(${users.pushMode}, ${pushSubscriptions.mode})`,
      })
      .from(pushSubscriptions)
      .innerJoin(
        sessions,
        and(
          eq(sessions.id, pushSubscriptions.sessionId),
          eq(sessions.userId, pushSubscriptions.userId),
        ),
      )
      .innerJoin(users, eq(users.id, pushSubscriptions.userId))
      // A handful of people per room, so one placeholder each is the simpler shape; a list that
      // could grow with user input would need `sql.param` and an array cast instead.
      .where(and(inArray(pushSubscriptions.userId, ids), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.updatedAt), desc(sessions.createdAt), desc(sessions.id))

    const counts = new Map<string, number>()
    return rows.flatMap((row) => {
      if (row.sessionId === null) return []
      const count = counts.get(row.userId) ?? 0
      if (count >= MAX_ACTIVE_SESSIONS_PER_USER) return []
      counts.set(row.userId, count + 1)
      return [{ ...row, sessionId: row.sessionId }]
    })
  }

  /** This person's own devices, for the list they manage. */
  async listForUser(
    userId: string,
    currentSessionId: string,
  ): Promise<
    Array<{
      id: string
      userAgent: string | null
      mode: PushSubscriptionMode
      createdAt: Date
      isCurrent: boolean
    }>
  > {
    return this.db
      .select({
        id: pushSubscriptions.id,
        userAgent: pushSubscriptions.userAgent,
        mode: sql<Mode>`COALESCE(${users.pushMode}, ${pushSubscriptions.mode})`,
        createdAt: pushSubscriptions.createdAt,
        isCurrent: sql<boolean>`${pushSubscriptions.sessionId} = ${currentSessionId}`,
      })
      .from(pushSubscriptions)
      .innerJoin(
        sessions,
        and(
          eq(sessions.id, pushSubscriptions.sessionId),
          eq(sessions.userId, pushSubscriptions.userId),
        ),
      )
      .innerJoin(users, eq(users.id, pushSubscriptions.userId))
      .where(and(eq(pushSubscriptions.userId, userId), gt(sessions.expiresAt, new Date())))
      .orderBy(sql`${pushSubscriptions.createdAt} DESC`)
  }

  /**
   * The switch is per PERSON, not per device (Nikola, 2026-08-23) — so it lands on every row this
   * person has. `users.push_mode` is the durable source of truth; mirroring it onto transport rows
   * keeps rolling deploys and old rows readable.
   */
  async setMode(userId: string, mode: Mode): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Updating the source row takes the same lock `subscribe` uses, preventing a stale rebind.
      await tx.update(users).set({ pushMode: mode }).where(eq(users.id, userId))
      await tx.update(pushSubscriptions).set({ mode }).where(eq(pushSubscriptions.userId, userId))
    })
  }

  /** Removing one device, by the person who owns it. */
  async removeForSession(userId: string, sessionId: string, id: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.sessionId, sessionId),
          eq(pushSubscriptions.id, id),
        ),
      )
  }

  /**
   * Removes exactly the stale transport the push service just rejected.
   *
   * Every loaded value participates so an old in-flight result cannot erase a subscription that
   * was refreshed or transferred while that send was pending.
   */
  async removeIfMatches(subscription: StoredPushSubscription): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.id, subscription.id),
          eq(pushSubscriptions.userId, subscription.userId),
          eq(pushSubscriptions.sessionId, subscription.sessionId),
          eq(pushSubscriptions.endpoint, subscription.endpoint),
          eq(pushSubscriptions.p256dh, subscription.p256dh),
          eq(pushSubscriptions.auth, subscription.auth),
        ),
      )
  }
}
