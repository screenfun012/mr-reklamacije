import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: pg.Pool
let client: pg.PoolClient
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  await migrate(createDb(pool), { migrationsFolder: resolve(__dirname, '../../../migrations') })
})

// Transaction-per-test, like the catalogue suites beside it.
beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
  db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>
})

afterEach(async () => {
  await client.query('ROLLBACK')
  client.release()
})

afterAll(async () => {
  await pool.end()
})

/**
 * Drizzle wraps a failed query in its own Error and keeps the driver's as the cause — the
 * constraint NAME lives only in there. Asserting on it pins WHICH rule refused.
 */
async function expectConstraint(run: Promise<unknown>, constraint: string): Promise<void> {
  await expect(run).rejects.toSatisfy((error: unknown) => {
    const cause = (error as { cause?: { constraint?: string } }).cause
    return cause?.constraint === constraint
  })
}

async function anyUserId(): Promise<string> {
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).limit(1)
  if (user === undefined) {
    throw new Error('no user in the test database')
  }
  return user.id
}

/** A claim of our own, so the suite does not depend on what the demo seed happens to hold. */
async function newEmotiveClaimId(): Promise<string> {
  const [engineType] = await db
    .select({ id: schema.engineTypes.id })
    .from(schema.engineTypes)
    .limit(1)
  if (engineType === undefined) {
    throw new Error('no engine type in the test database')
  }
  const [claim] = await db
    .insert(schema.emotiveClaims)
    .values({
      engineTypeId: engineType.id,
      dateOfClaim: new Date('2026-08-23T00:00:00.000Z'),
      mrNumber: `CHAT-${Date.now()}-${Math.round(Math.random() * 1e6)}/26`,
      outcome: 'pending',
      claimYear: 2026,
      createdBy: await anyUserId(),
    })
    .returning({ id: schema.emotiveClaims.id })
  return claim?.id ?? ''
}

async function newDomaceClaimId(): Promise<string> {
  const [claim] = await db
    .insert(schema.domaceClaims)
    .values({
      outcome: 'pending',
      claimYear: 2026,
      customerName: 'Proba',
      createdBy: await anyUserId(),
    })
    .returning({ id: schema.domaceClaims.id })
  return claim?.id ?? ''
}

async function newConversation(): Promise<string> {
  const [row] = await db
    .insert(schema.chatConversations)
    .values({ type: 'channel', name: 'Proba', createdBy: await anyUserId() })
    .returning({ id: schema.chatConversations.id })
  return row?.id ?? ''
}

describe('migration 0053 — the chat tables', () => {
  it('keeps one thread per claim', async () => {
    const claimId = await newEmotiveClaimId()
    const createdBy = await anyUserId()
    await db
      .insert(schema.chatConversations)
      .values({ type: 'claim', emotiveClaimId: claimId, createdBy })

    // „1 reklamacija = 1 nit" (spec §8.3) — expressible only as a partial unique index, because
    // a claim is two tables and there is no single claim_id column to make unique.
    await expectConstraint(
      db
        .insert(schema.chatConversations)
        .values({ type: 'claim', emotiveClaimId: claimId, createdBy }),
      'uq_chat_conversations_emotive_claim',
    )
  })

  it('refuses a thread that claims to be both kinds at once', async () => {
    await expectConstraint(
      db.insert(schema.chatConversations).values({
        type: 'claim',
        emotiveClaimId: await newEmotiveClaimId(),
        domaceClaimId: await newDomaceClaimId(),
        createdBy: await anyUserId(),
      }),
      'chat_conversations_one_of_claim_check',
    )
  })

  it('refuses a thread with no claim at all', async () => {
    await expectConstraint(
      db.insert(schema.chatConversations).values({ type: 'claim', createdBy: await anyUserId() }),
      'chat_conversations_one_of_claim_check',
    )
  })

  it('refuses a channel without a name', async () => {
    await expectConstraint(
      db.insert(schema.chatConversations).values({ type: 'channel', createdBy: await anyUserId() }),
      'chat_conversations_channel_name_check',
    )
  })

  it('allows only one general channel', async () => {
    const createdBy = await anyUserId()
    await db
      .insert(schema.chatConversations)
      .values({ type: 'general', name: 'Opšti kanal', createdBy })
    await expectConstraint(
      db
        .insert(schema.chatConversations)
        .values({ type: 'general', name: 'Drugi opšti', createdBy }),
      'uq_chat_conversations_general',
    )
  })

  it('gives every message a rising seq', async () => {
    const conversationId = await newConversation()
    const authorId = await anyUserId()
    const [first] = await db
      .insert(schema.chatMessages)
      .values({ conversationId, authorId, body: 'prva', clientMsgId: crypto.randomUUID() })
      .returning({ seq: schema.chatMessages.seq })
    const [second] = await db
      .insert(schema.chatMessages)
      .values({ conversationId, authorId, body: 'druga', clientMsgId: crypto.randomUUID() })
      .returning({ seq: schema.chatMessages.seq })

    // The order key. Never created_at: the ids are UUID v4 and equal timestamps would be untied
    // by randomness, which is what makes "how far have I read" and the recovery window honest.
    expect(second?.seq).toBeGreaterThan(first?.seq ?? 0n)
  })

  it('takes the same client id from one author only once', async () => {
    const conversationId = await newConversation()
    const authorId = await anyUserId()
    const clientMsgId = crypto.randomUUID()
    await db
      .insert(schema.chatMessages)
      .values({ conversationId, authorId, body: 'zdravo', clientMsgId })

    // A retried send — a flaky tablet, a resent POST — must land exactly once.
    await expectConstraint(
      db
        .insert(schema.chatMessages)
        .values({ conversationId, authorId, body: 'zdravo', clientMsgId }),
      'uq_chat_messages_author_client_msg',
    )
  })

  it('lets two system messages share a client id, because neither has an author', async () => {
    const conversationId = await newConversation()
    const clientMsgId = crypto.randomUUID()
    await db.insert(schema.chatMessages).values({
      conversationId,
      body: 'Nit napravljena',
      clientMsgId,
      systemKind: 'thread_created',
    })

    // The unique index is PARTIAL on author_id IS NOT NULL — otherwise the second system message
    // in a conversation would be refused for a reason that has nothing to do with it.
    await expect(
      db.insert(schema.chatMessages).values({
        conversationId,
        body: 'Ishod promenjen',
        clientMsgId,
        systemKind: 'outcome_changed',
      }),
    ).resolves.toBeDefined()
  })

  it('keeps the messages when the author account is deleted — they are evidence', async () => {
    const conversationId = await newConversation()
    const [author] = await db
      .insert(schema.users)
      .values({
        id: crypto.randomUUID(),
        name: 'Privremeni',
        email: `chat-test-${Date.now()}@local.test`,
        emailVerified: false,
      })
      .returning({ id: schema.users.id })
    const [message] = await db
      .insert(schema.chatMessages)
      .values({
        conversationId,
        authorId: author?.id,
        body: 'dokaz',
        clientMsgId: crypto.randomUUID(),
      })
      .returning({ id: schema.chatMessages.id })

    await db.delete(schema.users).where(eq(schema.users.id, author?.id ?? ''))

    const [kept] = await db
      .select({ body: schema.chatMessages.body, authorId: schema.chatMessages.authorId })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, message?.id ?? ''))
    // SET NULL, never CASCADE (spec §4): a person leaves, what was said about a claim stays.
    expect(kept).toEqual({ body: 'dokaz', authorId: null })
  })
})
