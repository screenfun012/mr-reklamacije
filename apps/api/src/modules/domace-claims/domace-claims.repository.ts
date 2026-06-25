import { schema } from '@mr/db'
import { ClaimKind } from '@mr/shared'
import { and, desc, eq, gte, isNotNull, isNull, lte, sql, type SQL } from 'drizzle-orm'

import type { FaultsRepository } from '../../core/claims/faults.repository.js'
import {
  initialOutcomeResolvedAt,
  outcomeResolvedAtForTransition,
} from '../../core/claims/outcome-resolved-at.js'
import type { ApiDatabase } from '../../core/database.js'
import { InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { MrRegistryService } from '../../core/mr-registry/index.js'
import { domaceClaimYearFromDate } from './claim-year.js'
import { domaceClaimFaults, domaceClaims } from './domace-claims.schema.js'
import type { DomaceClaimsListScope } from './domace-claims.types.js'
import type {
  DomaceClaimChangeOutcomeInput,
  DomaceClaimCreateInput,
  DomaceClaimDetail,
  DomaceClaimFaultItem,
  DomaceClaimListItem,
  DomaceClaimListQuery,
  DomaceClaimListResponse,
  DomaceClaimUpdateInput,
} from './domace-claims.validators.js'

const { departments, employees, engineManufacturers, engineTypes, externalParties } = schema

function formatDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString().slice(0, 10)
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

function mapFaultRow(row: {
  id: string
  faultType: string
  employeeId: string | null
  employeeName: string | null
  departmentId: string | null
  departmentName: string | null
  externalPartyId: string | null
  externalPartyName: string | null
  notes: string | null
}): DomaceClaimFaultItem {
  return {
    id: row.id,
    faultType: row.faultType as DomaceClaimFaultItem['faultType'],
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    externalPartyId: row.externalPartyId,
    externalPartyName: row.externalPartyName,
    notes: row.notes,
  }
}

function mapListItem(row: {
  id: string
  sequenceNumber: number
  claimNumber: string | null
  customerName: string | null
  warrantyReport: string | null
  engineTypeId: string | null
  engineTypeCode: string | null
  manufacturerId: string | null
  manufacturerName: string | null
  engineCode: string | null
  dateOfClaim: Date | string | null
  mrNumber: string | null
  dateOfFinish: Date | string | null
  employeeId: string | null
  employeeName: string | null
  outcome: string
  claimYear: number
  totalAmount: number | null
  createdAt: Date
}): DomaceClaimListItem {
  return {
    kind: ClaimKind.Domace,
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    claimNumber: row.claimNumber,
    customerName: row.customerName,
    warrantyReport: row.warrantyReport,
    engineTypeId: row.engineTypeId,
    engineTypeCode: row.engineTypeCode,
    manufacturerId: row.manufacturerId,
    manufacturerName: row.manufacturerName,
    engineCode: row.engineCode,
    dateOfClaim: row.dateOfClaim === null ? null : formatDate(row.dateOfClaim),
    mrNumber: row.mrNumber,
    dateOfFinish: row.dateOfFinish === null ? null : formatDate(row.dateOfFinish),
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    outcome: row.outcome as DomaceClaimListItem['outcome'],
    claimYear: row.claimYear,
    totalAmount: row.totalAmount,
    createdAt: formatTimestamp(row.createdAt),
  }
}

export class DomaceClaimsRepository {
  constructor(
    private readonly db: ApiDatabase,
    private readonly faultsRepo: FaultsRepository<typeof domaceClaimFaults>,
    private readonly mrRegistry: MrRegistryService,
  ) {}

  async isEngineTypeActive(engineTypeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: engineTypes.id })
      .from(engineTypes)
      .where(
        and(
          eq(engineTypes.id, engineTypeId),
          isNull(engineTypes.deletedAt),
          eq(engineTypes.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async isManufacturerActive(manufacturerId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: engineManufacturers.id })
      .from(engineManufacturers)
      .where(
        and(
          eq(engineManufacturers.id, manufacturerId),
          isNull(engineManufacturers.deletedAt),
          eq(engineManufacturers.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async isEmployeeActive(employeeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          isNull(employees.deletedAt),
          eq(employees.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async isDepartmentActive(departmentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          eq(departments.id, departmentId),
          isNull(departments.deletedAt),
          eq(departments.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async isExternalPartyActive(externalPartyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: externalParties.id })
      .from(externalParties)
      .where(
        and(
          eq(externalParties.id, externalPartyId),
          isNull(externalParties.deletedAt),
          eq(externalParties.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async create(input: DomaceClaimCreateInput, actorId: string): Promise<DomaceClaimDetail> {
    const claimYear = domaceClaimYearFromDate(input.dateOfClaim ?? null)

    const createdId = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(domaceClaims)
        .values({
          mrNumber: input.mrNumber ?? null,
          customerName: input.customerName ?? null,
          warrantyReport: input.warrantyReport ?? null,
          engineTypeId: input.engineTypeId ?? null,
          manufacturerId: input.manufacturerId ?? null,
          engineCode: input.engineCode ?? null,
          dateOfClaim: input.dateOfClaim ?? null,
          dateOfFinish: input.dateOfFinish ?? null,
          employeeId: input.employeeId ?? null,
          outcome: input.outcome,
          outcomeResolvedAt: initialOutcomeResolvedAt(input.outcome),
          claimYear,
          totalAmount: input.totalAmount ?? null,
          claimNumber: input.claimNumber ?? null,
          internalNotes: input.internalNotes ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning({ id: domaceClaims.id })

      const claimId = created?.id
      if (claimId === undefined) {
        throw new InternalError('Failed to insert domace claim')
      }

      await this.faultsRepo.insertMany(tx, claimId, input.faults)

      await this.mrRegistry.claimMr(input.mrNumber ?? null, ClaimKind.Domace, claimId, tx)

      if (input.engineTypeId !== undefined) {
        await tx
          .update(engineTypes)
          .set({ usageCount: sql`${engineTypes.usageCount} + 1` })
          .where(eq(engineTypes.id, input.engineTypeId))
      }

      return claimId
    })

    const detail = await this.findById(createdId, { type: 'all' })
    if (detail === null) {
      throw new InternalError('Created domace claim not found')
    }

    return detail
  }

  async list(
    query: DomaceClaimListQuery,
    scope: DomaceClaimsListScope,
  ): Promise<DomaceClaimListResponse> {
    // DOMACE claims have no customer linkage yet, so an own_customer-only actor
    // (e.g. portal client) sees nothing.
    if (scope.type === 'own_customer') {
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize }
    }

    const conditions: SQL[] = []

    if (!query.includeDeleted) {
      conditions.push(isNull(domaceClaims.deletedAt))
    }

    if (query.outcome !== undefined) {
      conditions.push(eq(domaceClaims.outcome, query.outcome))
    }

    if (query.manufacturerId !== undefined) {
      conditions.push(eq(domaceClaims.manufacturerId, query.manufacturerId))
    }

    if (query.dateFrom !== undefined) {
      conditions.push(gte(domaceClaims.dateOfClaim, query.dateFrom))
    }

    if (query.dateTo !== undefined) {
      conditions.push(lte(domaceClaims.dateOfClaim, query.dateTo))
    }

    if (query.search !== undefined) {
      conditions.push(
        sql`to_tsvector('simple', coalesce(${domaceClaims.warrantyReport}, '') || ' ' || coalesce(${domaceClaims.customerName}, '')) @@ websearch_to_tsquery('simple', ${query.search})`,
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const offset = (query.page - 1) * query.pageSize

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(domaceClaims)
      .where(whereClause)

    const total = countRow?.total ?? 0

    const rows = await this.db
      .select({
        id: domaceClaims.id,
        sequenceNumber: domaceClaims.sequenceNumber,
        claimNumber: domaceClaims.claimNumber,
        customerName: domaceClaims.customerName,
        warrantyReport: domaceClaims.warrantyReport,
        engineTypeId: domaceClaims.engineTypeId,
        engineTypeCode: engineTypes.code,
        manufacturerId: domaceClaims.manufacturerId,
        manufacturerName: engineManufacturers.name,
        engineCode: domaceClaims.engineCode,
        dateOfClaim: domaceClaims.dateOfClaim,
        mrNumber: domaceClaims.mrNumber,
        dateOfFinish: domaceClaims.dateOfFinish,
        employeeId: domaceClaims.employeeId,
        employeeName: employees.fullName,
        outcome: domaceClaims.outcome,
        claimYear: domaceClaims.claimYear,
        totalAmount: domaceClaims.totalAmount,
        createdAt: domaceClaims.createdAt,
      })
      .from(domaceClaims)
      .leftJoin(engineTypes, eq(domaceClaims.engineTypeId, engineTypes.id))
      .leftJoin(engineManufacturers, eq(domaceClaims.manufacturerId, engineManufacturers.id))
      .leftJoin(employees, eq(domaceClaims.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(domaceClaims.dateOfClaim), desc(domaceClaims.id))
      .limit(query.pageSize)
      .offset(offset)

    return {
      items: rows.map(mapListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async findById(id: string, scope: DomaceClaimsListScope): Promise<DomaceClaimDetail | null> {
    return this.fetchById(id, scope, 'active')
  }

  async findDeletedById(
    id: string,
    scope: DomaceClaimsListScope,
  ): Promise<DomaceClaimDetail | null> {
    return this.fetchById(id, scope, 'deleted')
  }

  private async fetchById(
    id: string,
    scope: DomaceClaimsListScope,
    mode: 'active' | 'deleted',
  ): Promise<DomaceClaimDetail | null> {
    if (scope.type === 'own_customer') {
      return null
    }

    const deletedCondition =
      mode === 'active' ? isNull(domaceClaims.deletedAt) : isNotNull(domaceClaims.deletedAt)

    const [row] = await this.db
      .select({
        id: domaceClaims.id,
        sequenceNumber: domaceClaims.sequenceNumber,
        claimNumber: domaceClaims.claimNumber,
        customerName: domaceClaims.customerName,
        warrantyReport: domaceClaims.warrantyReport,
        engineTypeId: domaceClaims.engineTypeId,
        engineTypeCode: engineTypes.code,
        engineTypeManufacturer: engineTypes.manufacturer,
        manufacturerId: domaceClaims.manufacturerId,
        manufacturerName: engineManufacturers.name,
        engineCode: domaceClaims.engineCode,
        dateOfClaim: domaceClaims.dateOfClaim,
        mrNumber: domaceClaims.mrNumber,
        dateOfFinish: domaceClaims.dateOfFinish,
        employeeId: domaceClaims.employeeId,
        employeeName: employees.fullName,
        outcome: domaceClaims.outcome,
        claimYear: domaceClaims.claimYear,
        totalAmount: domaceClaims.totalAmount,
        createdAt: domaceClaims.createdAt,
        internalNotes: domaceClaims.internalNotes,
        updatedBy: domaceClaims.updatedBy,
        updatedAt: domaceClaims.updatedAt,
      })
      .from(domaceClaims)
      .leftJoin(engineTypes, eq(domaceClaims.engineTypeId, engineTypes.id))
      .leftJoin(engineManufacturers, eq(domaceClaims.manufacturerId, engineManufacturers.id))
      .leftJoin(employees, eq(domaceClaims.employeeId, employees.id))
      .where(and(eq(domaceClaims.id, id), deletedCondition))
      .limit(1)

    if (row === undefined) {
      return null
    }

    const faults = await this.db
      .select({
        id: domaceClaimFaults.id,
        faultType: domaceClaimFaults.faultType,
        employeeId: domaceClaimFaults.employeeId,
        employeeName: employees.fullName,
        departmentId: domaceClaimFaults.departmentId,
        departmentName: departments.nameSr,
        externalPartyId: domaceClaimFaults.externalPartyId,
        externalPartyName: externalParties.name,
        notes: domaceClaimFaults.notes,
      })
      .from(domaceClaimFaults)
      .leftJoin(employees, eq(domaceClaimFaults.employeeId, employees.id))
      .leftJoin(departments, eq(domaceClaimFaults.departmentId, departments.id))
      .leftJoin(externalParties, eq(domaceClaimFaults.externalPartyId, externalParties.id))
      .where(eq(domaceClaimFaults.claimId, id))

    const { internalNotes, updatedBy, updatedAt, engineTypeManufacturer, ...listFields } = row

    return {
      ...mapListItem(listFields),
      engineTypeManufacturer,
      internalNotes,
      updatedBy,
      updatedAt: formatTimestamp(updatedAt),
      faults: faults.map(mapFaultRow),
    }
  }

  async update(
    id: string,
    input: DomaceClaimUpdateInput,
    actorId: string,
    scope: DomaceClaimsListScope,
  ): Promise<DomaceClaimDetail> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Domace claim', id)
    }

    const patch: Partial<typeof domaceClaims.$inferInsert> = {
      updatedBy: actorId,
    }

    if (input.mrNumber !== undefined) {
      patch.mrNumber = input.mrNumber
    }
    if (input.customerName !== undefined) {
      patch.customerName = input.customerName
    }
    if (input.warrantyReport !== undefined) {
      patch.warrantyReport = input.warrantyReport
    }
    if (input.engineTypeId !== undefined) {
      patch.engineTypeId = input.engineTypeId
    }
    if (input.manufacturerId !== undefined) {
      patch.manufacturerId = input.manufacturerId
    }
    if (input.engineCode !== undefined) {
      patch.engineCode = input.engineCode
    }
    if (input.dateOfClaim !== undefined) {
      patch.dateOfClaim = input.dateOfClaim
      patch.claimYear = domaceClaimYearFromDate(input.dateOfClaim)
    }
    if (input.employeeId !== undefined) {
      patch.employeeId = input.employeeId
    }
    if (input.claimNumber !== undefined) {
      patch.claimNumber = input.claimNumber
    }
    if (input.dateOfFinish !== undefined) {
      patch.dateOfFinish = input.dateOfFinish
    }
    if (input.internalNotes !== undefined) {
      patch.internalNotes = input.internalNotes
    }

    await this.db.transaction(async (tx) => {
      await tx.update(domaceClaims).set(patch).where(eq(domaceClaims.id, id))

      if (input.faults !== undefined) {
        await this.faultsRepo.replaceForClaim(tx, id, input.faults)
      }

      if (input.mrNumber !== undefined) {
        await this.mrRegistry.syncMrNumberChange(
          tx,
          ClaimKind.Domace,
          id,
          existing.mrNumber,
          input.mrNumber,
        )
      }
    })

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Domace claim', id)
    }

    return updated
  }

  async updateAmount(
    id: string,
    totalAmount: number | null,
    actorId: string,
    scope: DomaceClaimsListScope,
  ): Promise<DomaceClaimDetail> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Domace claim', id)
    }

    await this.db
      .update(domaceClaims)
      .set({ totalAmount, updatedBy: actorId })
      .where(eq(domaceClaims.id, id))

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Domace claim', id)
    }

    return updated
  }

  async softDelete(id: string, actorId: string, scope: DomaceClaimsListScope): Promise<void> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Domace claim', id)
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(domaceClaims)
        .set({ deletedAt: new Date(), updatedBy: actorId })
        .where(eq(domaceClaims.id, id))

      await this.mrRegistry.releaseMr(existing.mrNumber, tx)
    })
  }

  async restore(
    id: string,
    actorId: string,
    scope: DomaceClaimsListScope,
  ): Promise<DomaceClaimDetail> {
    const existing = await this.findDeletedById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Domace claim', id)
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(domaceClaims)
        .set({ deletedAt: null, updatedBy: actorId })
        .where(eq(domaceClaims.id, id))

      await this.mrRegistry.claimMr(existing.mrNumber, ClaimKind.Domace, id, tx)
    })

    const restored = await this.findById(id, scope)
    if (restored === null) {
      throw new NotFoundError('Domace claim', id)
    }

    return restored
  }

  async changeOutcome(
    id: string,
    input: DomaceClaimChangeOutcomeInput,
    actorId: string,
    scope: DomaceClaimsListScope,
  ): Promise<DomaceClaimDetail> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Domace claim', id)
    }

    const resolvedAtPatch = outcomeResolvedAtForTransition(existing.outcome, input.outcome)
    const patch: {
      outcome: typeof input.outcome
      updatedBy: string
      outcomeResolvedAt?: Date | null
    } = {
      outcome: input.outcome,
      updatedBy: actorId,
    }
    if (resolvedAtPatch !== undefined) {
      patch.outcomeResolvedAt = resolvedAtPatch
    }

    await this.db.update(domaceClaims).set(patch).where(eq(domaceClaims.id, id))

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Domace claim', id)
    }

    return updated
  }
}
