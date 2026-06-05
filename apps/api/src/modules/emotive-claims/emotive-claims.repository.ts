import { schema } from '@mr/db'
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  buildPaginatedSlice,
  encodeKeysetCursor,
  parseOptionalKeysetCursor,
  type KeysetCursor,
} from '../../core/utils/pagination.js'
import { NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import { claimYearFromDate } from './claim-year.js'
import {
  claimSources,
  customerUsers,
  emotiveClaimFaults,
  emotiveClaims,
} from './emotive-claims.schema.js'
import type { EmotiveClaimsListScope } from './emotive-claims.types.js'
import type {
  EmotiveClaimChangeOutcomeInput,
  EmotiveClaimCreateInput,
  EmotiveClaimDetail,
  EmotiveClaimFaultItem,
  EmotiveClaimListItem,
  EmotiveClaimListQuery,
  EmotiveClaimListResponse,
  EmotiveClaimUpdateInput,
} from './emotive-claims.validators.js'
import { FaultsRepository } from './faults/faults.repository.js'

const { customers, departments, employees, engineTypes, externalParties } = schema

function formatDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString().slice(0, 10)
}

function keysetBeforeDateOfClaim(
  cursor: KeysetCursor | null,
): SQL | undefined {
  if (cursor === null) {
    return undefined
  }

  const dateValue =
    typeof cursor.primary === 'string' ? cursor.primary : formatDate(cursor.primary as Date)

  return sql`(${emotiveClaims.dateOfClaim}, ${emotiveClaims.id}) < (${dateValue}::date, ${cursor.id}::uuid)`
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

function mapFaultRow(row: {
  id: string
  faultType: string
  employeeId: string | null
  departmentId: string | null
  externalPartyId: string | null
  notes: string | null
}): EmotiveClaimFaultItem {
  return {
    id: row.id,
    faultType: row.faultType as EmotiveClaimFaultItem['faultType'],
    employeeId: row.employeeId,
    departmentId: row.departmentId,
    externalPartyId: row.externalPartyId,
    notes: row.notes,
  }
}

function mapListItem(row: {
  id: string
  sequenceNumber: number
  claimNumber: string | null
  warrantyReport: string
  engineTypeId: string
  dateOfClaim: Date | string
  mrNumber: string
  dateOfFinish: Date | string | null
  employeeId: string
  sourceId: string
  outcome: string
  claimYear: number
  customerId: string | null
  createdAt: Date
}): EmotiveClaimListItem {
  return {
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    claimNumber: row.claimNumber,
    warrantyReport: row.warrantyReport,
    engineTypeId: row.engineTypeId,
    dateOfClaim: formatDate(row.dateOfClaim),
    mrNumber: row.mrNumber,
    dateOfFinish: row.dateOfFinish === null ? null : formatDate(row.dateOfFinish),
    employeeId: row.employeeId,
    sourceId: row.sourceId,
    outcome: row.outcome as EmotiveClaimListItem['outcome'],
    claimYear: row.claimYear,
    customerId: row.customerId,
    createdAt: formatTimestamp(row.createdAt),
  }
}

export class EmotiveClaimsRepository {
  private readonly faultsRepo = new FaultsRepository()

  constructor(private readonly db: ApiDatabase) {}

  async getSourceDefaultCustomerId(sourceId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ defaultCustomerId: claimSources.defaultCustomerId })
      .from(claimSources)
      .where(and(eq(claimSources.id, sourceId), isNull(claimSources.deletedAt)))
      .limit(1)

    return row?.defaultCustomerId ?? null
  }

  async getUserCustomerIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ customerId: customerUsers.customerId })
      .from(customerUsers)
      .where(eq(customerUsers.userId, userId))

    return rows.map((row) => row.customerId)
  }

  async assertActiveEngineType(engineTypeId: string): Promise<void> {
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
    if (row === undefined) {
      throw new ValidationError('Invalid or inactive engine type')
    }
  }

  async assertActiveEmployee(employeeId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(eq(employees.id, employeeId), isNull(employees.deletedAt), eq(employees.isActive, true)),
      )
      .limit(1)
    if (row === undefined) {
      throw new ValidationError('Invalid or inactive employee')
    }
  }

  async assertActiveClaimSource(sourceId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: claimSources.id })
      .from(claimSources)
      .where(
        and(eq(claimSources.id, sourceId), isNull(claimSources.deletedAt), eq(claimSources.isActive, true)),
      )
      .limit(1)
    if (row === undefined) {
      throw new ValidationError('Invalid or inactive claim source')
    }
  }

  async assertActiveCustomer(customerId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.id, customerId), isNull(customers.deletedAt), eq(customers.isActive, true)),
      )
      .limit(1)
    if (row === undefined) {
      throw new ValidationError('Invalid or inactive customer')
    }
  }

  async assertActiveDepartment(departmentId: string): Promise<void> {
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
    if (row === undefined) {
      throw new ValidationError('Invalid or inactive department')
    }
  }

  async assertActiveExternalParty(externalPartyId: string): Promise<void> {
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
    if (row === undefined) {
      throw new ValidationError('Invalid or inactive external party')
    }
  }

  async create(
    input: EmotiveClaimCreateInput,
    actorId: string,
    customerId: string | null,
  ): Promise<EmotiveClaimDetail> {
    const claimYear = claimYearFromDate(input.dateOfClaim)

    const createdId = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(emotiveClaims)
        .values({
          warrantyReport: input.warrantyReport,
          engineTypeId: input.engineTypeId,
          dateOfClaim: input.dateOfClaim,
          mrNumber: input.mrNumber,
          dateOfFinish: input.dateOfFinish ?? null,
          employeeId: input.employeeId,
          sourceId: input.sourceId,
          outcome: input.outcome,
          claimYear,
          customerId,
          claimNumber: input.claimNumber ?? null,
          internalNotes: input.internalNotes ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning({ id: emotiveClaims.id })

      const claimId = created?.id
      if (claimId === undefined) {
        throw new Error('Failed to insert emotive claim')
      }

      await this.faultsRepo.insertMany(tx, claimId, input.faults)

      await tx
        .update(engineTypes)
        .set({ usageCount: sql`${engineTypes.usageCount} + 1` })
        .where(eq(engineTypes.id, input.engineTypeId))

      return claimId
    })

    const detail = await this.findById(createdId, { type: 'all' })
    if (detail === null) {
      throw new Error('Created emotive claim not found')
    }

    return detail
  }

  async list(
    query: EmotiveClaimListQuery,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimListResponse> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = []

    if (!query.includeDeleted) {
      conditions.push(isNull(emotiveClaims.deletedAt))
    }

    if (query.outcome !== undefined) {
      conditions.push(eq(emotiveClaims.outcome, query.outcome))
    }

    if (query.sourceId !== undefined) {
      conditions.push(eq(emotiveClaims.sourceId, query.sourceId))
    }

    if (query.customerId !== undefined) {
      conditions.push(eq(emotiveClaims.customerId, query.customerId))
    }

    if (query.dateFrom !== undefined) {
      conditions.push(gte(emotiveClaims.dateOfClaim, query.dateFrom))
    }

    if (query.dateTo !== undefined) {
      conditions.push(lte(emotiveClaims.dateOfClaim, query.dateTo))
    }

    if (query.search !== undefined) {
      conditions.push(
        sql`to_tsvector('simple', ${emotiveClaims.warrantyReport}) @@ websearch_to_tsquery('simple', ${query.search})`,
      )
    }

    if (scope.type === 'own_customer') {
      const customerIds = await this.getUserCustomerIds(scope.userId)
      if (customerIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false }
      }
      conditions.push(inArray(emotiveClaims.customerId, customerIds))
    }

    const keysetCondition = keysetBeforeDateOfClaim(cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: emotiveClaims.id,
        sequenceNumber: emotiveClaims.sequenceNumber,
        claimNumber: emotiveClaims.claimNumber,
        warrantyReport: emotiveClaims.warrantyReport,
        engineTypeId: emotiveClaims.engineTypeId,
        dateOfClaim: emotiveClaims.dateOfClaim,
        mrNumber: emotiveClaims.mrNumber,
        dateOfFinish: emotiveClaims.dateOfFinish,
        employeeId: emotiveClaims.employeeId,
        sourceId: emotiveClaims.sourceId,
        outcome: emotiveClaims.outcome,
        claimYear: emotiveClaims.claimYear,
        customerId: emotiveClaims.customerId,
        createdAt: emotiveClaims.createdAt,
      })
      .from(emotiveClaims)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emotiveClaims.dateOfClaim), desc(emotiveClaims.id))
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: formatDate(row.dateOfClaim),
      id: row.id,
    }))

    return {
      items: page.items.map(mapListItem),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string, scope: EmotiveClaimsListScope): Promise<EmotiveClaimDetail | null> {
    const [row] = await this.db
      .select()
      .from(emotiveClaims)
      .where(and(eq(emotiveClaims.id, id), isNull(emotiveClaims.deletedAt)))
      .limit(1)

    if (row === undefined) {
      return null
    }

    if (!(await this.canAccessClaim(row.customerId, scope))) {
      return null
    }

    const faults = await this.db
      .select({
        id: emotiveClaimFaults.id,
        faultType: emotiveClaimFaults.faultType,
        employeeId: emotiveClaimFaults.employeeId,
        departmentId: emotiveClaimFaults.departmentId,
        externalPartyId: emotiveClaimFaults.externalPartyId,
        notes: emotiveClaimFaults.notes,
      })
      .from(emotiveClaimFaults)
      .where(eq(emotiveClaimFaults.claimId, id))

    return {
      ...mapListItem(row),
      internalNotes: row.internalNotes,
      updatedBy: row.updatedBy,
      updatedAt: formatTimestamp(row.updatedAt),
      faults: faults.map(mapFaultRow),
    }
  }

  async update(
    id: string,
    input: EmotiveClaimUpdateInput,
    actorId: string,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    const patch: Partial<typeof emotiveClaims.$inferInsert> = {
      updatedBy: actorId,
    }

    if (input.warrantyReport !== undefined) {
      patch.warrantyReport = input.warrantyReport
    }
    if (input.engineTypeId !== undefined) {
      patch.engineTypeId = input.engineTypeId
    }
    if (input.dateOfClaim !== undefined) {
      patch.dateOfClaim = input.dateOfClaim
      patch.claimYear = claimYearFromDate(input.dateOfClaim)
    }
    if (input.mrNumber !== undefined) {
      patch.mrNumber = input.mrNumber
    }
    if (input.employeeId !== undefined) {
      patch.employeeId = input.employeeId
    }
    if (input.sourceId !== undefined) {
      patch.sourceId = input.sourceId
    }
    if (input.claimNumber !== undefined) {
      patch.claimNumber = input.claimNumber
    }
    if (input.dateOfFinish !== undefined) {
      patch.dateOfFinish = input.dateOfFinish
    }
    if (input.customerId !== undefined) {
      patch.customerId = input.customerId
    }
    if (input.internalNotes !== undefined) {
      patch.internalNotes = input.internalNotes
    }

    await this.db.transaction(async (tx) => {
      await tx.update(emotiveClaims).set(patch).where(eq(emotiveClaims.id, id))

      if (input.faults !== undefined) {
        await this.faultsRepo.replaceForClaim(tx, id, input.faults)
      }
    })

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    return updated
  }

  async replaceFaults(
    claimId: string,
    faults: NonNullable<EmotiveClaimUpdateInput['faults']>,
    actorId: string,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail> {
    return this.update(claimId, { faults }, actorId, scope)
  }

  async softDelete(id: string, actorId: string, scope: EmotiveClaimsListScope): Promise<void> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    await this.db
      .update(emotiveClaims)
      .set({ deletedAt: new Date(), updatedBy: actorId })
      .where(eq(emotiveClaims.id, id))
  }

  async changeOutcome(
    id: string,
    input: EmotiveClaimChangeOutcomeInput,
    actorId: string,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail> {
    const existing = await this.findById(id, scope)
    if (existing === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    await this.db
      .update(emotiveClaims)
      .set({ outcome: input.outcome, updatedBy: actorId })
      .where(eq(emotiveClaims.id, id))

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    return updated
  }

  private async canAccessClaim(
    customerId: string | null,
    scope: EmotiveClaimsListScope,
  ): Promise<boolean> {
    if (scope.type === 'all') {
      return true
    }

    if (customerId === null) {
      return false
    }

    const allowed = await this.getUserCustomerIds(scope.userId)
    return allowed.includes(customerId)
  }
}

export function listCursorFromItem(item: EmotiveClaimListItem): KeysetCursor {
  return { primary: item.dateOfClaim, id: item.id }
}

export { encodeKeysetCursor }
