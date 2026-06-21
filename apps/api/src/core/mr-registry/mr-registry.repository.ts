import { schema } from '@mr/db'
import { ClaimKind, type ClaimKind as ClaimKindType } from '@mr/shared'
import { eq } from 'drizzle-orm'

import type { ApiDatabase, ApiDbExecutor } from '../database.js'

const { mrRegistry } = schema

export interface MrRegistryRow {
  claimKind: ClaimKindType
  emotiveClaimId: string | null
  domaceClaimId: string | null
}

export class MrRegistryRepository {
  constructor(private readonly db: ApiDatabase) {}

  async findByMrKey(
    executor: Pick<ApiDbExecutor, 'select'>,
    mrKey: string,
  ): Promise<MrRegistryRow | null> {
    const [row] = await executor
      .select({
        claimKind: mrRegistry.claimKind,
        emotiveClaimId: mrRegistry.emotiveClaimId,
        domaceClaimId: mrRegistry.domaceClaimId,
      })
      .from(mrRegistry)
      .where(eq(mrRegistry.mrKey, mrKey))
      .limit(1)

    return row ?? null
  }

  async insert(
    executor: Pick<ApiDbExecutor, 'insert'>,
    mrKey: string,
    kind: ClaimKindType,
    claimId: string,
  ): Promise<void> {
    await executor.insert(mrRegistry).values({
      mrKey,
      claimKind: kind,
      emotiveClaimId: kind === ClaimKind.Emotive ? claimId : null,
      domaceClaimId: kind === ClaimKind.Domace ? claimId : null,
    })
  }

  async deleteByMrKey(executor: Pick<ApiDbExecutor, 'delete'>, mrKey: string): Promise<void> {
    await executor.delete(mrRegistry).where(eq(mrRegistry.mrKey, mrKey))
  }

  /** Read outside an open transaction (lookup endpoint / findByMr). */
  findByMrKeyOnDb(mrKey: string): Promise<MrRegistryRow | null> {
    return this.findByMrKey(this.db, mrKey)
  }
}
