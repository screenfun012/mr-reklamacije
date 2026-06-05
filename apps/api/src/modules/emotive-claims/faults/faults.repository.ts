import type { EmotiveClaimFaultInput } from '@mr/shared'
import { eq } from 'drizzle-orm'
import type { ApiDatabase } from '../../../core/database.js'
import { emotiveClaimFaults } from '../emotive-claims.schema.js'

type DbExecutor = Pick<ApiDatabase, 'insert' | 'delete'>

function toFaultRow(claimId: string, fault: EmotiveClaimFaultInput) {
  switch (fault.faultType) {
    case 'employee':
      return {
        claimId,
        faultType: fault.faultType,
        employeeId: fault.employeeId,
        departmentId: null,
        externalPartyId: null,
        notes: fault.notes ?? null,
      }
    case 'department':
      return {
        claimId,
        faultType: fault.faultType,
        employeeId: null,
        departmentId: fault.departmentId,
        externalPartyId: null,
        notes: fault.notes ?? null,
      }
    case 'external':
      return {
        claimId,
        faultType: fault.faultType,
        employeeId: null,
        departmentId: null,
        externalPartyId: fault.externalPartyId,
        notes: fault.notes ?? null,
      }
  }
}

export class FaultsRepository {
  async insertMany(
    db: DbExecutor,
    claimId: string,
    faults: readonly EmotiveClaimFaultInput[],
  ): Promise<void> {
    if (faults.length === 0) {
      return
    }

    await db.insert(emotiveClaimFaults).values(faults.map((fault) => toFaultRow(claimId, fault)))
  }

  async deleteByClaimId(db: DbExecutor, claimId: string): Promise<void> {
    await db.delete(emotiveClaimFaults).where(eq(emotiveClaimFaults.claimId, claimId))
  }

  async replaceForClaim(
    db: DbExecutor,
    claimId: string,
    faults: readonly EmotiveClaimFaultInput[],
  ): Promise<void> {
    await this.deleteByClaimId(db, claimId)
    await this.insertMany(db, claimId, faults)
  }
}
