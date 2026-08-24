import type { PushSubscriptionMode } from '@mr/shared'
import { and, eq, inArray, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'

import { pushSubscriptions } from './push.schema.js'

/** One browser to send to. Nothing here is shown to anybody — it is all transport. */
export interface StoredPushSubscription {
  readonly id: string
  readonly userId: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly mode: PushSubscriptionMode
}

export interface PushSubscriptionInput {
  readonly userId: string
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
   * The mode is deliberately NOT reset here — somebody re-subscribing on a device they already had
   * keeps the switch where they left it.
   */
  async subscribe(input: PushSubscriptionInput): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: input.userId,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
        },
      })
  }

  /** Everything to send to, for a whole fan-out at once. */
  async listForUsers(userIds: readonly string[]): Promise<StoredPushSubscription[]> {
    const ids = [...new Set(userIds)]
    if (ids.length === 0) {
      return []
    }

    return (
      this.db
        .select({
          id: pushSubscriptions.id,
          userId: pushSubscriptions.userId,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
          mode: pushSubscriptions.mode,
        })
        .from(pushSubscriptions)
        // A handful of people per room, so one placeholder each is the simpler shape; a list that
        // could grow with user input would need `sql.param` and an array cast instead.
        .where(inArray(pushSubscriptions.userId, ids))
    )
  }

  /** This person's own devices, for the list they manage. */
  async listForUser(
    userId: string,
  ): Promise<
    Array<{ id: string; userAgent: string | null; mode: PushSubscriptionMode; createdAt: Date }>
  > {
    return this.db
      .select({
        id: pushSubscriptions.id,
        userAgent: pushSubscriptions.userAgent,
        mode: pushSubscriptions.mode,
        createdAt: pushSubscriptions.createdAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(sql`${pushSubscriptions.createdAt} DESC`)
  }

  /**
   * The switch is per PERSON, not per device (Nikola, 2026-08-23) — so it lands on every row this
   * person has. The column lives on the subscription because the row already exists; a second
   * table for one field would be a table nobody needs.
   */
  async setMode(userId: string, mode: PushSubscriptionMode): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ mode })
      .where(eq(pushSubscriptions.userId, userId))
  }

  /** Removing one device, by the person who owns it. */
  async removeForUser(userId: string, id: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.id, id)))
  }

  /**
   * Removing one the push service says is gone.
   *
   * ⚠ By endpoint, not by id: this is called from the send path, which knows the address it just
   * failed to reach and nothing else about the row.
   */
  async removeByEndpoint(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  }
}
