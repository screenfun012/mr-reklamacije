import type { ClaimFaultInput } from '@mr/shared'
import { eq } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { ApiDatabase } from '../database.js'

type DbExecutor = Pick<ApiDatabase, 'insert' | 'delete'>

interface FaultRow {
  claimId: string
  faultType: ClaimFaultInput['faultType']
  employeeId: string | null
  departmentId: string | null
  externalPartyId: string | null
  notes: string | null
}

/**
 * Structural contract shared by `emotive_claim_faults` and `domace_claim_faults`:
 * both have a `claim_id` FK plus the polymorphic employee/department/external columns.
 */
type FaultsTable = PgTable & { claimId: PgColumn }

function toFaultRow(claimId: string, fault: ClaimFaultInput): FaultRow {
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

/**
 * Persists fault attributions for any claim module. The concrete faults table
 * is injected at construction so EMOTIVE and DOMACE share one implementation.
 */
export class FaultsRepository<TTable extends FaultsTable = FaultsTable> {
  constructor(private readonly table: TTable) {}

  async insertMany(
    db: DbExecutor,
    claimId: string,
    faults: readonly ClaimFaultInput[],
  ): Promise<void> {
    if (faults.length === 0) {
      return
    }

    const rows = faults.map((fault) => toFaultRow(claimId, fault))
    await db.insert(this.table).values(rows as TTable['$inferInsert'][])
  }

  async deleteByClaimId(db: DbExecutor, claimId: string): Promise<void> {
    await db.delete(this.table).where(eq(this.table.claimId, claimId))
  }

  async replaceForClaim(
    db: DbExecutor,
    claimId: string,
    faults: readonly ClaimFaultInput[],
  ): Promise<void> {
    await this.deleteByClaimId(db, claimId)
    await this.insertMany(db, claimId, faults)
  }
}
