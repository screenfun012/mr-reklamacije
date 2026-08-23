import { ChatConversationType } from '@mr/shared'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

/** The one channel everyone internal is in. Named in Serbian because the office reads it. */
const GENERAL_CHANNEL_NAME = 'Opšti kanal'

/**
 * Every environment starts with exactly one general channel.
 *
 * A SEED and not a migration, for the same reason departments and claim sources are: it is
 * reference data the app expects to find, and a fresh environment — a restored database, a new
 * staging — must get one without anyone remembering to create it by hand.
 *
 * Idempotence is the partial unique index `uq_chat_conversations_general` plus `ON CONFLICT DO
 * NOTHING`, not a read-then-write check: a second general channel cannot exist at all, so there is
 * nothing for a guard to decide. (One was written here first and removed — breaking it changed
 * nothing, which is how it showed itself to be dead weight.)
 *
 * `created_by` stays NULL on purpose: the shop created it, not a person.
 */
export async function seedGeneralChannel(db: NodePgDatabase<typeof schema>): Promise<void> {
  const inserted = await db
    .insert(schema.chatConversations)
    .values({ type: ChatConversationType.General, name: GENERAL_CHANNEL_NAME })
    .onConflictDoNothing()
    .returning({ id: schema.chatConversations.id })

  console.log(`[seed:chat] Inserted ${inserted.length} / 1 general channel`)
}
