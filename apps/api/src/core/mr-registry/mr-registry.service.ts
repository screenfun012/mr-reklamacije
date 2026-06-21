import { ClaimKind, normalizeMrKey, type ClaimKind as ClaimKindType } from '@mr/shared'

import type { ApiDbExecutor } from '../database.js'
import type { MrKeyConflictExistingClaim } from '../errors/domain-errors.js'
import { ConflictError, MrKeyConflictError } from '../errors/domain-errors.js'
import type { MrRegistryRow } from './mr-registry.repository.js'
import { MrRegistryRepository } from './mr-registry.repository.js'

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  if ('code' in error && error.code === '23505') {
    return true
  }

  if ('cause' in error && isUniqueViolation(error.cause)) {
    return true
  }

  return false
}

function toExistingClaim(row: MrRegistryRow): MrKeyConflictExistingClaim {
  if (row.claimKind === ClaimKind.Emotive) {
    if (row.emotiveClaimId === null) {
      throw new Error('mr_registry emotive row missing emotive_claim_id')
    }
    return { kind: ClaimKind.Emotive, claimId: row.emotiveClaimId }
  }

  if (row.domaceClaimId === null) {
    throw new Error('mr_registry domace row missing domace_claim_id')
  }
  return { kind: ClaimKind.Domace, claimId: row.domaceClaimId }
}

export class MrRegistryService {
  constructor(private readonly repo: MrRegistryRepository) {}

  async claimMr(
    rawMr: string | null | undefined,
    kind: ClaimKindType,
    claimId: string,
    tx: ApiDbExecutor,
  ): Promise<void> {
    const mrKey = normalizeMrKey(rawMr)
    if (mrKey === null) {
      return
    }

    const occupied = await this.repo.findByMrKey(tx, mrKey)
    if (occupied !== null) {
      throw new MrKeyConflictError(toExistingClaim(occupied))
    }

    try {
      await this.repo.insert(tx, mrKey, kind, claimId)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('MR broj je već dodeljen drugoj reklamaciji')
      }
      throw error
    }
  }

  async findByMr(rawMr: string | null | undefined): Promise<MrKeyConflictExistingClaim | null> {
    const mrKey = normalizeMrKey(rawMr)
    if (mrKey === null) {
      return null
    }

    const row = await this.repo.findByMrKeyOnDb(mrKey)
    if (row === null) {
      return null
    }

    return toExistingClaim(row)
  }

  async releaseMr(
    rawMr: string | null | undefined,
    tx: Pick<ApiDbExecutor, 'delete'>,
  ): Promise<void> {
    const mrKey = normalizeMrKey(rawMr)
    if (mrKey === null) {
      return
    }

    await this.repo.deleteByMrKey(tx, mrKey)
  }

  async syncMrNumberChange(
    tx: ApiDbExecutor,
    kind: ClaimKindType,
    claimId: string,
    previousMrNumber: string | null,
    nextMrNumber: string | null,
  ): Promise<void> {
    const oldKey = normalizeMrKey(previousMrNumber)
    const newKey = normalizeMrKey(nextMrNumber)
    if (oldKey === newKey) {
      return
    }

    if (oldKey !== null) {
      await this.releaseMr(previousMrNumber, tx)
    }

    if (newKey !== null) {
      await this.claimMr(nextMrNumber, kind, claimId, tx)
    }
  }
}
