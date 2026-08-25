import { schema } from '@mr/db'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import type { ApiDatabase } from '../../core/database.js'

export interface ChatConversationFence {
  shared<T>(conversationId: string, work: (db: ApiDatabase) => Promise<T>): Promise<T>
  exclusive<T>(conversationId: string, work: (db: ApiDatabase) => Promise<T>): Promise<T>
}

export class PostgresChatConversationFence implements ChatConversationFence {
  constructor(private readonly pool: Pool) {}

  shared<T>(conversationId: string, work: (db: ApiDatabase) => Promise<T>): Promise<T> {
    return this.withLock('shared', conversationId, work)
  }

  exclusive<T>(conversationId: string, work: (db: ApiDatabase) => Promise<T>): Promise<T> {
    return this.withLock('exclusive', conversationId, work)
  }

  private async withLock<T>(
    mode: 'shared' | 'exclusive',
    conversationId: string,
    work: (db: ApiDatabase) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect()
    const suffix = mode === 'shared' ? '_shared' : ''

    try {
      await client.query(`SELECT pg_advisory_lock${suffix}(hashtextextended($1::text, 0))`, [
        conversationId,
      ])
    } catch (error) {
      client.release(asError(error))
      throw error
    }

    let result!: T
    let workFailed = false
    let workFailure: unknown
    let unlockFailure: unknown
    try {
      result = await work(drizzle(client, { schema }) as ApiDatabase)
    } catch (error) {
      workFailed = true
      workFailure = error
    } finally {
      try {
        const unlocked = await client.query<{ unlocked: boolean }>(
          `SELECT pg_advisory_unlock${suffix}(hashtextextended($1::text, 0)) AS unlocked`,
          [conversationId],
        )
        if (unlocked.rows[0]?.unlocked !== true) {
          unlockFailure = new Error(`Chat conversation ${mode} advisory lock was not held`)
        }
      } catch (error) {
        unlockFailure = error
      }

      if (unlockFailure === undefined) {
        client.release()
      } else {
        client.release(asError(unlockFailure))
      }
    }

    if (unlockFailure !== undefined) {
      throw unlockFailure
    }
    if (workFailed) {
      throw workFailure
    }
    return result
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
