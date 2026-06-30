import { createHash, randomBytes } from 'node:crypto'

import { and, eq, gt, isNull } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { clientActivationTokens } from './activation.schema.js'

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export class ActivationRepository {
  constructor(private readonly db: ApiDatabase) {}

  /**
   * Invalidate any still-valid tokens for the user, then mint a fresh one.
   * Returns the RAW token (only its SHA-256 hash is persisted).
   */
  async mint(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    await this.db
      .update(clientActivationTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(clientActivationTokens.userId, userId), isNull(clientActivationTokens.usedAt)))

    await this.db.insert(clientActivationTokens).values({ userId, tokenHash, expiresAt })

    return rawToken
  }

  /**
   * Atomically consume a token: it must exist, be unused, and not be expired.
   * Stamps `used_at` in the same UPDATE so it can never be reused. Returns the
   * owning userId, or null when the token is invalid/expired/already used.
   */
  async consume(rawToken: string): Promise<string | null> {
    const tokenHash = hashToken(rawToken)
    const now = new Date()

    const [row] = await this.db
      .update(clientActivationTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(clientActivationTokens.tokenHash, tokenHash),
          isNull(clientActivationTokens.usedAt),
          gt(clientActivationTokens.expiresAt, now),
        ),
      )
      .returning({ userId: clientActivationTokens.userId })

    return row?.userId ?? null
  }
}
