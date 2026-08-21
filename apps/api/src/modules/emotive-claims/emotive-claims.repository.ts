import { schema } from '@mr/db'
import {
  ClaimKind,
  UserAccountStatus,
  type ClaimCategoryRef,
  type SectionFreshness,
  type UserLanguage,
} from '@mr/shared'
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import {
  categoryFieldValuesFor,
  withCategoryFieldValues,
} from '../../core/claims/category-field-values-store.js'
import { missingRequiredCategoryFieldsSql } from '../../core/claims/category-field-usage-sql.js'
import { describePreviousCategoryFieldValues } from '../../core/claims/previous-category-field-values.js'
import type { ApiClaimTxExecutor, ApiDatabase } from '../../core/database.js'
import {
  initialOutcomeResolvedAt,
  outcomeResolvedAtForTransition,
} from '../../core/claims/outcome-resolved-at.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { MrRegistryService } from '../../core/mr-registry/index.js'
import { claimYearFromDate } from './claim-year.js'
import {
  claimSources,
  customerUsers,
  emotiveClaimClientViews,
  emotiveClaimFaults,
  emotiveClaims,
  users,
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

const {
  claimCategories,
  customers,
  departments,
  employees,
  engineManufacturers,
  engineTypes,
  externalParties,
} = schema

const engineTypeMfg = alias(engineManufacturers, 'engine_type_manufacturer')

// Thrown when a mutation's compare-and-swap WHERE matches 0 rows — the claim's
// state (deleted_at / outcome) changed between the service before-read and the
// write, so the asserted precondition is stale. Maps to HTTP 409.
const CONCURRENT_EDIT_MESSAGE = 'Claim was modified concurrently; reload and retry'

export interface OutcomeNotificationRecipient {
  email: string
  name: string
  preferredLanguage: UserLanguage
}

function formatDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString().slice(0, 10)
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

// Gate A: a non-blank inspection report is what makes an EMOTIVE claim client-visible.
// The Zod validator already trims; this stays defensive against undefined/null/non-string callers.
const hasInspectionReport = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0

// Freshness fires only when a client-visible field is set to a value the client can
// actually look at — a non-null, non-blank value. Clearing a field (empty/blank string
// or null) is a removal: SSE still fires, but the NEW/UPDATE badge and 'Novo' markers do
// not. Non-string non-null values (dates, FK ids) are meaningful.
const isMeaningfulValue = (v: unknown): boolean =>
  v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')

// Phase 3 freshness: exactly the fields the client wire (`ClientClaimDetailSchema`)
// exposes for an EMOTIVE claim. Setting ANY of them to a meaningful value bumps
// `client_content_updated_at` to now() on create/update/publish —
// internalNotes/faults/sourceId/claimNumber/amounts never do, and clearing one never
// does. Shared by create and update so the whitelist lives in exactly one place.
interface ClientVisibleFieldsInput {
  warrantyReport?: unknown
  inspectionReport?: unknown
  dateOfClaim?: unknown
  dateOfFinish?: unknown
  engineCode?: unknown
  engineTypeId?: unknown
  manufacturerId?: unknown
  employeeId?: unknown
  mrNumber?: unknown
}

// Phase 3.1 section markers: 'details' covers everything client-visible except the
// inspection report, which gets its own 'inspection' key (see bumpSectionsSql below).
function touchesDetailsFields(input: ClientVisibleFieldsInput): boolean {
  return [
    input.warrantyReport,
    input.dateOfClaim,
    input.dateOfFinish,
    input.engineCode,
    input.engineTypeId,
    input.manufacturerId,
    input.employeeId,
    input.mrNumber,
  ].some(isMeaningfulValue)
}

function touchesClientVisibleFields(input: ClientVisibleFieldsInput): boolean {
  return hasInspectionReport(input.inspectionReport) || touchesDetailsFields(input)
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
}): EmotiveClaimFaultItem {
  return {
    id: row.id,
    faultType: row.faultType as EmotiveClaimFaultItem['faultType'],
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    externalPartyId: row.externalPartyId,
    externalPartyName: row.externalPartyName,
    notes: row.notes,
  }
}

/**
 * The kind of work the claim is about. `null` only for a row that predates the column —
 * create and update both require it, so anything written through the API carries one.
 */
function mapCategoryRef(
  id: string | null,
  code: string | null,
  name: string | null,
  isActive: boolean | null,
  deactivatedAt: Date | null,
): ClaimCategoryRef | null {
  if (id === null || code === null || name === null || isActive === null) {
    return null
  }
  return { id, code, name, isActive, deactivatedAt: deactivatedAt?.toISOString() ?? null }
}

function mapListItem(row: {
  id: string
  sequenceNumber: number
  claimNumber: string | null
  warrantyReport: string | null
  engineTypeId: string
  engineTypeCode: string
  manufacturerId: string | null
  manufacturerName: string | null
  engineCode: string | null
  dateOfClaim: Date | string
  mrNumber: string
  dateOfFinish: Date | string | null
  employeeId: string | null
  employeeName: string | null
  sourceId: string | null
  outcome: string
  claimYear: number
  customerId: string | null
  customerName: string | null
  categoryId: string | null
  missingRequiredCategoryFields: string[]
  categoryCode: string | null
  categoryName: string | null
  categoryIsActive: boolean | null
  categoryDeactivatedAt: Date | null
  createdAt: Date
  clientVisibleAt: Date | null
  publishedAt: Date | null
}): EmotiveClaimListItem {
  return {
    kind: ClaimKind.Emotive,
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    claimNumber: row.claimNumber,
    warrantyReport: row.warrantyReport,
    engineTypeId: row.engineTypeId,
    engineTypeCode: row.engineTypeCode,
    manufacturerId: row.manufacturerId,
    manufacturerName: row.manufacturerName,
    engineCode: row.engineCode,
    dateOfClaim: formatDate(row.dateOfClaim),
    mrNumber: row.mrNumber,
    dateOfFinish: row.dateOfFinish === null ? null : formatDate(row.dateOfFinish),
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    sourceId: row.sourceId,
    outcome: row.outcome as EmotiveClaimListItem['outcome'],
    claimYear: row.claimYear,
    customerId: row.customerId,
    customerName: row.customerName,
    missingRequiredCategoryFields: row.missingRequiredCategoryFields,
    category: mapCategoryRef(
      row.categoryId,
      row.categoryCode,
      row.categoryName,
      row.categoryIsActive,
      row.categoryDeactivatedAt,
    ),
    createdAt: formatTimestamp(row.createdAt),
    clientVisibleAt: row.clientVisibleAt === null ? null : formatTimestamp(row.clientVisibleAt),
    publishedAt: row.publishedAt === null ? null : formatTimestamp(row.publishedAt),
    // This module serves internal/full-view actors only (no per-client-user
    // viewer) — freshness is a unified-list, client-portal-only signal.
    freshness: null,
  }
}

export class EmotiveClaimsRepository {
  constructor(
    private readonly db: ApiDatabase,
    private readonly faultsRepo: FaultsRepository,
    private readonly mrRegistry: MrRegistryService,
  ) {}

  /**
   * Phase 3.1 section markers: builds a jsonb_set chain that stamps now() at each given
   * section key, starting from the existing column (or '{}' if null). Keys always come
   * from the fixed allowlist above — never user input — but are still bound as SQL
   * parameters (no sql.raw) rather than inlined into the query text.
   */
  private bumpSectionsSql(keys: readonly string[]) {
    let expr = sql`COALESCE(${emotiveClaims.sectionUpdatedAt}, '{}'::jsonb)`
    for (const key of keys) {
      expr = sql`jsonb_set(${expr}, ${`{${key}}`}::text[], to_jsonb(now()))`
    }
    return expr
  }

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

  /** Live, approved portal accounts linked to a customer — the outcome-change email audience. */
  async getOutcomeNotificationRecipients(
    customerId: string,
  ): Promise<OutcomeNotificationRecipient[]> {
    return this.db
      .select({
        email: users.email,
        name: users.name,
        preferredLanguage: users.preferredLanguage,
      })
      .from(customerUsers)
      .innerJoin(users, eq(users.id, customerUsers.userId))
      .where(
        and(
          eq(customerUsers.customerId, customerId),
          isNull(users.deletedAt),
          eq(users.isActive, true),
          eq(users.accountStatus, UserAccountStatus.Approved),
        ),
      )
  }

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

  async getEngineTypeManufacturerId(engineTypeId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ manufacturerId: engineTypes.manufacturerId })
      .from(engineTypes)
      .where(and(eq(engineTypes.id, engineTypeId), isNull(engineTypes.deletedAt)))
      .limit(1)

    return row?.manufacturerId ?? null
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

  async isClaimCategoryActive(categoryId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: claimCategories.id })
      .from(claimCategories)
      .where(
        and(
          eq(claimCategories.id, categoryId),
          isNull(claimCategories.deletedAt),
          eq(claimCategories.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async isClaimSourceActive(sourceId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: claimSources.id })
      .from(claimSources)
      .where(
        and(
          eq(claimSources.id, sourceId),
          isNull(claimSources.deletedAt),
          eq(claimSources.isActive, true),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async isCustomerActive(customerId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          isNull(customers.deletedAt),
          eq(customers.isActive, true),
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

  async create(
    input: EmotiveClaimCreateInput,
    actorId: string,
    customerId: string | null,
  ): Promise<EmotiveClaimDetail> {
    const createdId = await this.db.transaction((tx) =>
      this.createWithinTransaction(tx, input, actorId, customerId),
    )

    const detail = await this.findById(createdId, { type: 'all' })
    if (detail === null) {
      throw new InternalError('Created emotive claim not found')
    }

    return detail
  }

  /**
   * Inserts the emotive claim (+ faults, MR registry entry, engine-type usage) inside a
   * caller-provided transaction and returns the new claim id. Used both by `create` and by
   * the client-submissions conversion, which extends the same transaction with the
   * attachment re-point + submission status update so the whole conversion is atomic.
   */
  async createWithinTransaction(
    tx: ApiClaimTxExecutor,
    input: EmotiveClaimCreateInput,
    actorId: string,
    customerId: string | null,
  ): Promise<string> {
    const claimYear = claimYearFromDate(input.dateOfClaim)

    // Phase 3.1 section markers: mirror clientContentUpdatedAt's meaningful-value logic,
    // split per section, so the freshest-changed-section signal starts correct on create.
    const initialSections: Record<string, string> = {}
    const nowIso = new Date().toISOString()
    if (hasInspectionReport(input.inspectionReport)) {
      initialSections['inspection'] = nowIso
    }
    if (touchesDetailsFields(input)) {
      initialSections['details'] = nowIso
    }

    const [created] = await tx
      .insert(emotiveClaims)
      .values({
        warrantyReport: input.warrantyReport ?? null,
        engineTypeId: input.engineTypeId,
        manufacturerId: input.manufacturerId ?? null,
        categoryId: input.categoryId,
        categoryFieldValues: withCategoryFieldValues(
          null,
          input.categoryId,
          input.categoryFieldValues ?? {},
        ),
        engineCode: input.engineCode ?? null,
        dateOfClaim: input.dateOfClaim,
        mrNumber: input.mrNumber,
        dateOfFinish: input.dateOfFinish ?? null,
        employeeId: input.employeeId ?? null,
        sourceId: input.sourceId ?? null,
        outcome: input.outcome,
        outcomeResolvedAt: initialOutcomeResolvedAt(input.outcome),
        claimYear,
        customerId,
        claimNumber: input.claimNumber ?? null,
        internalNotes: input.internalNotes ?? null,
        findings: input.findings,
        inspectionReport: input.inspectionReport ?? null,
        clientVisibleAt: hasInspectionReport(input.inspectionReport) ? new Date() : null,
        clientContentUpdatedAt: touchesClientVisibleFields(input) ? new Date() : null,
        sectionUpdatedAt: Object.keys(initialSections).length > 0 ? initialSections : null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: emotiveClaims.id })

    const claimId = created?.id
    if (claimId === undefined) {
      throw new InternalError('Failed to insert emotive claim')
    }

    await this.faultsRepo.insertMany(tx, claimId, input.faults)

    await this.mrRegistry.claimMr(input.mrNumber, ClaimKind.Emotive, claimId, tx)

    await tx
      .update(engineTypes)
      .set({ usageCount: sql`${engineTypes.usageCount} + 1` })
      .where(eq(engineTypes.id, input.engineTypeId))

    return claimId
  }

  async list(
    query: EmotiveClaimListQuery,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimListResponse> {
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

    if (query.manufacturerId !== undefined) {
      conditions.push(eq(emotiveClaims.manufacturerId, query.manufacturerId))
    }

    if (query.dateFrom !== undefined) {
      conditions.push(gte(emotiveClaims.dateOfClaim, query.dateFrom))
    }

    if (query.dateTo !== undefined) {
      conditions.push(lte(emotiveClaims.dateOfClaim, query.dateTo))
    }

    if (query.search !== undefined) {
      // Must stay textually identical to idx_emotive_claims_search_fts (and to
      // the unified claims list search) so the GIN index actually serves it.
      conditions.push(
        sql`to_tsvector('simple', coalesce(${emotiveClaims.warrantyReport}, '') || ' ' || ${emotiveClaims.mrNumber}) @@ websearch_to_tsquery('simple', ${query.search})`,
      )
    }

    if (scope.type === 'own_customer') {
      const customerIds = await this.getUserCustomerIds(scope.userId)
      if (customerIds.length === 0) {
        return { items: [], total: 0, page: query.page, pageSize: query.pageSize }
      }
      conditions.push(inArray(emotiveClaims.customerId, customerIds))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const offset = (query.page - 1) * query.pageSize

    const countQuery = this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(emotiveClaims)
      .where(whereClause)

    const pageQuery = this.db
      .select({
        id: emotiveClaims.id,
        sequenceNumber: emotiveClaims.sequenceNumber,
        claimNumber: emotiveClaims.claimNumber,
        warrantyReport: emotiveClaims.warrantyReport,
        engineTypeId: emotiveClaims.engineTypeId,
        engineTypeCode: engineTypes.code,
        manufacturerId: emotiveClaims.manufacturerId,
        manufacturerName: engineManufacturers.name,
        engineCode: emotiveClaims.engineCode,
        dateOfClaim: emotiveClaims.dateOfClaim,
        mrNumber: emotiveClaims.mrNumber,
        dateOfFinish: emotiveClaims.dateOfFinish,
        employeeId: emotiveClaims.employeeId,
        employeeName: employees.fullName,
        sourceId: emotiveClaims.sourceId,
        outcome: emotiveClaims.outcome,
        claimYear: emotiveClaims.claimYear,
        customerId: emotiveClaims.customerId,
        customerName: customers.name,
        categoryId: emotiveClaims.categoryId,
        missingRequiredCategoryFields: missingRequiredCategoryFieldsSql('emotive_claims'),
        categoryCode: claimCategories.code,
        categoryName: claimCategories.name,
        categoryIsActive: claimCategories.isActive,
        categoryDeactivatedAt: claimCategories.deactivatedAt,
        createdAt: emotiveClaims.createdAt,
        clientVisibleAt: emotiveClaims.clientVisibleAt,
        publishedAt: emotiveClaims.publishedAt,
      })
      .from(emotiveClaims)
      .leftJoin(customers, eq(emotiveClaims.customerId, customers.id))
      .innerJoin(engineTypes, eq(emotiveClaims.engineTypeId, engineTypes.id))
      .leftJoin(engineManufacturers, eq(emotiveClaims.manufacturerId, engineManufacturers.id))
      .leftJoin(claimCategories, eq(emotiveClaims.categoryId, claimCategories.id))
      .leftJoin(employees, eq(emotiveClaims.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(emotiveClaims.dateOfClaim), desc(emotiveClaims.id))
      .limit(query.pageSize)
      .offset(offset)

    // Count + page run concurrently — same scan cost, half the latency.
    const [countRows, rows] = await Promise.all([countQuery, pageQuery])
    const total = countRows[0]?.total ?? 0

    return {
      items: rows.map(mapListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async findById(id: string, scope: EmotiveClaimsListScope): Promise<EmotiveClaimDetail | null> {
    return this.fetchById(id, scope, 'active')
  }

  async findDeletedById(
    id: string,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail | null> {
    return this.fetchById(id, scope, 'deleted')
  }

  private async fetchById(
    id: string,
    scope: EmotiveClaimsListScope,
    mode: 'active' | 'deleted',
  ): Promise<EmotiveClaimDetail | null> {
    const deletedCondition =
      mode === 'active' ? isNull(emotiveClaims.deletedAt) : isNotNull(emotiveClaims.deletedAt)

    const commonFields = {
      id: emotiveClaims.id,
      sequenceNumber: emotiveClaims.sequenceNumber,
      claimNumber: emotiveClaims.claimNumber,
      warrantyReport: emotiveClaims.warrantyReport,
      engineTypeId: emotiveClaims.engineTypeId,
      engineTypeCode: engineTypes.code,
      engineTypeManufacturer: engineTypeMfg.name,
      manufacturerId: emotiveClaims.manufacturerId,
      manufacturerName: engineManufacturers.name,
      categoryId: emotiveClaims.categoryId,
      categoryFieldValues: emotiveClaims.categoryFieldValues,
      missingRequiredCategoryFields: missingRequiredCategoryFieldsSql('emotive_claims'),
      categoryCode: claimCategories.code,
      categoryName: claimCategories.name,
      categoryIsActive: claimCategories.isActive,
      categoryDeactivatedAt: claimCategories.deactivatedAt,
      engineCode: emotiveClaims.engineCode,
      dateOfClaim: emotiveClaims.dateOfClaim,
      mrNumber: emotiveClaims.mrNumber,
      dateOfFinish: emotiveClaims.dateOfFinish,
      employeeId: emotiveClaims.employeeId,
      employeeName: employees.fullName,
      sourceId: emotiveClaims.sourceId,
      sourceCode: claimSources.code,
      sourceName: claimSources.name,
      outcome: emotiveClaims.outcome,
      claimYear: emotiveClaims.claimYear,
      customerId: emotiveClaims.customerId,
      customerName: customers.name,
      createdAt: emotiveClaims.createdAt,
      clientVisibleAt: emotiveClaims.clientVisibleAt,
      publishedAt: emotiveClaims.publishedAt,
      internalNotes: emotiveClaims.internalNotes,
      findings: emotiveClaims.findings,
      inspectionReport: emotiveClaims.inspectionReport,
      updatedBy: emotiveClaims.updatedBy,
      updatedAt: emotiveClaims.updatedAt,
    }

    // Openable gate: mirrors the service's Primljeno check — a client-facing
    // section can only be "fresh" once the claim has left the private state.
    const openable = sql`(${emotiveClaims.clientVisibleAt} IS NOT NULL OR ${emotiveClaims.publishedAt} IS NOT NULL)`

    const [row] =
      scope.type === 'own_customer'
        ? await this.db
            .select({
              ...commonFields,
              // Phase 3.1: per-section NEW/UPDATE marker for THIS viewer, computed
              // against their own emotive_claim_client_views row. findById is a pure
              // read (Task 1) — `viewedAt` here only ever advances via the explicit
              // markClientSeen call, never as a side effect of this SELECT.
              sectionFreshness: sql<SectionFreshness>`jsonb_build_object(
                'photos',     ${openable} AND ${emotiveClaims.sectionUpdatedAt}->>'photos'     IS NOT NULL AND (${emotiveClaimClientViews.viewedAt} IS NULL OR (${emotiveClaims.sectionUpdatedAt}->>'photos')::timestamptz     > ${emotiveClaimClientViews.viewedAt}),
                'inspection', ${openable} AND ${emotiveClaims.sectionUpdatedAt}->>'inspection' IS NOT NULL AND (${emotiveClaimClientViews.viewedAt} IS NULL OR (${emotiveClaims.sectionUpdatedAt}->>'inspection')::timestamptz > ${emotiveClaimClientViews.viewedAt}),
                'details',    ${openable} AND ${emotiveClaims.sectionUpdatedAt}->>'details'    IS NOT NULL AND (${emotiveClaimClientViews.viewedAt} IS NULL OR (${emotiveClaims.sectionUpdatedAt}->>'details')::timestamptz    > ${emotiveClaimClientViews.viewedAt}),
                'outcome',    ${openable} AND ${emotiveClaims.sectionUpdatedAt}->>'outcome'    IS NOT NULL AND (${emotiveClaimClientViews.viewedAt} IS NULL OR (${emotiveClaims.sectionUpdatedAt}->>'outcome')::timestamptz    > ${emotiveClaimClientViews.viewedAt})
              )`,
            })
            .from(emotiveClaims)
            .leftJoin(customers, eq(emotiveClaims.customerId, customers.id))
            .innerJoin(engineTypes, eq(emotiveClaims.engineTypeId, engineTypes.id))
            .leftJoin(engineTypeMfg, eq(engineTypes.manufacturerId, engineTypeMfg.id))
            .leftJoin(engineManufacturers, eq(emotiveClaims.manufacturerId, engineManufacturers.id))
            .leftJoin(claimCategories, eq(emotiveClaims.categoryId, claimCategories.id))
            .leftJoin(employees, eq(emotiveClaims.employeeId, employees.id))
            .leftJoin(claimSources, eq(emotiveClaims.sourceId, claimSources.id))
            .leftJoin(
              emotiveClaimClientViews,
              and(
                eq(emotiveClaimClientViews.emotiveClaimId, emotiveClaims.id),
                eq(emotiveClaimClientViews.userId, scope.userId),
              ),
            )
            .where(and(eq(emotiveClaims.id, id), deletedCondition))
            .limit(1)
        : await this.db
            .select({
              ...commonFields,
              // Full-view/internal reads have no single "viewer" — no join, no
              // markers; always the all-false literal.
              sectionFreshness: sql<SectionFreshness>`jsonb_build_object('photos', false, 'inspection', false, 'details', false, 'outcome', false)`,
            })
            .from(emotiveClaims)
            .leftJoin(customers, eq(emotiveClaims.customerId, customers.id))
            .innerJoin(engineTypes, eq(emotiveClaims.engineTypeId, engineTypes.id))
            .leftJoin(engineTypeMfg, eq(engineTypes.manufacturerId, engineTypeMfg.id))
            .leftJoin(engineManufacturers, eq(emotiveClaims.manufacturerId, engineManufacturers.id))
            .leftJoin(claimCategories, eq(emotiveClaims.categoryId, claimCategories.id))
            .leftJoin(employees, eq(emotiveClaims.employeeId, employees.id))
            .leftJoin(claimSources, eq(emotiveClaims.sourceId, claimSources.id))
            .where(and(eq(emotiveClaims.id, id), deletedCondition))
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
        employeeName: employees.fullName,
        departmentId: emotiveClaimFaults.departmentId,
        departmentName: departments.nameSr,
        externalPartyId: emotiveClaimFaults.externalPartyId,
        externalPartyName: externalParties.name,
        notes: emotiveClaimFaults.notes,
      })
      .from(emotiveClaimFaults)
      .leftJoin(employees, eq(emotiveClaimFaults.employeeId, employees.id))
      .leftJoin(departments, eq(emotiveClaimFaults.departmentId, departments.id))
      .leftJoin(externalParties, eq(emotiveClaimFaults.externalPartyId, externalParties.id))
      .where(eq(emotiveClaimFaults.claimId, id))

    const {
      internalNotes,
      findings,
      inspectionReport,
      updatedBy,
      updatedAt,
      engineTypeManufacturer,
      sourceCode,
      sourceName,
      sectionFreshness,
      categoryFieldValues,
      ...listFields
    } = row

    return {
      ...mapListItem(listFields),
      engineTypeManufacturer,
      // The column is keyed by category; the screen is only ever shown the one it is in now.
      // The previous ones and the missing-required mark are the service's to fill in — naming
      // them takes the catalogue, which a claim repository has no business holding.
      categoryFieldValues: categoryFieldValuesFor(
        categoryFieldValues,
        listFields.categoryId ?? null,
      ),
      previousCategoryFieldValues: await describePreviousCategoryFieldValues(
        this.db,
        categoryFieldValues,
        listFields.categoryId ?? null,
      ),
      sourceCode,
      sourceName,
      internalNotes,
      findings,
      inspectionReport,
      updatedBy,
      updatedAt: formatTimestamp(updatedAt),
      faults: faults.map(mapFaultRow),
      sectionFreshness,
    }
  }

  async update(
    id: string,
    input: EmotiveClaimUpdateInput,
    actorId: string,
    before: EmotiveClaimDetail,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail> {
    // The scoped row-level gate (and the NotFound-on-missing check) already ran in
    // the service before-read; `before` is that same aggregate, passed down to avoid
    // a redundant heavy re-read here.
    const patch: Omit<
      Partial<typeof emotiveClaims.$inferInsert>,
      'clientVisibleAt' | 'sectionUpdatedAt'
    > & {
      clientVisibleAt?: SQL
      sectionUpdatedAt?: SQL
    } = {
      updatedBy: actorId,
    }

    // `before` carries only the answers of the category the claim is in now — the raw store is
    // what a write has to merge into, so that moving to another kind of work leaves the old
    // category's answers standing. One indexed read on a path that is already a transaction.
    const effectiveCategoryId = input.categoryId ?? before.category?.id ?? null
    const [storedRow] =
      input.categoryFieldValues === undefined
        ? []
        : await this.db
            .select({ values: emotiveClaims.categoryFieldValues })
            .from(emotiveClaims)
            .where(eq(emotiveClaims.id, id))
            .limit(1)
    const storedCategoryFieldValues = storedRow?.values ?? null

    if (input.warrantyReport !== undefined) {
      patch.warrantyReport = input.warrantyReport
    }
    if (input.engineTypeId !== undefined) {
      patch.engineTypeId = input.engineTypeId
    }
    if (input.manufacturerId !== undefined) {
      patch.manufacturerId = input.manufacturerId
    }
    if (input.categoryId !== undefined) {
      patch.categoryId = input.categoryId
    }
    if (input.categoryFieldValues !== undefined && effectiveCategoryId !== null) {
      // Written under the category the claim will HAVE. A move leaves the old category's answers
      // exactly where they were — the detail shows them as "Prethodna kategorija", and they come
      // back untouched if the move is undone.
      patch.categoryFieldValues = withCategoryFieldValues(
        storedCategoryFieldValues,
        effectiveCategoryId,
        input.categoryFieldValues,
      )
    }
    if (input.engineCode !== undefined) {
      patch.engineCode = input.engineCode
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
    if (input.findings !== undefined) {
      patch.findings = input.findings
    }
    if (input.inspectionReport !== undefined) {
      patch.inspectionReport = input.inspectionReport
    }
    // Gate A: the first time a non-blank client-visible report is saved, stamp
    // client_visible_at. COALESCE keeps it monotonic — never overwritten once set,
    // so a later clear of the report can't hide the claim again.
    if (hasInspectionReport(input.inspectionReport)) {
      patch.clientVisibleAt = sql`COALESCE(${emotiveClaims.clientVisibleAt}, now())`
    }

    // Phase 3 freshness: not monotonic — overwritten to now() on every qualifying
    // change (unlike clientVisibleAt above). Internal-only edits (internalNotes,
    // faults, sourceId, claimNumber, amounts) never touch it.
    if (touchesClientVisibleFields(input)) {
      patch.clientContentUpdatedAt = new Date()
    }

    // Phase 3.1 section markers: same meaningful-value whitelist, split per changed section.
    const sectionKeys: string[] = []
    if (hasInspectionReport(input.inspectionReport)) {
      sectionKeys.push('inspection')
    }
    if (touchesDetailsFields(input)) {
      sectionKeys.push('details')
    }
    if (sectionKeys.length > 0) {
      patch.sectionUpdatedAt = this.bumpSectionsSql(sectionKeys)
    }

    await this.db.transaction(async (tx) => {
      // Compare-and-swap: the write only lands if the claim is still in the state the
      // service asserted on `before` (not deleted, same outcome). 0 rows → the claim
      // changed concurrently → ConflictError rolls the whole tx back.
      const [row] = await tx
        .update(emotiveClaims)
        .set(patch)
        .where(
          and(
            eq(emotiveClaims.id, id),
            isNull(emotiveClaims.deletedAt),
            eq(emotiveClaims.outcome, before.outcome),
          ),
        )
        .returning({ id: emotiveClaims.id })
      if (row === undefined) {
        throw new ConflictError(CONCURRENT_EDIT_MESSAGE)
      }

      if (input.faults !== undefined) {
        await this.faultsRepo.replaceForClaim(tx, id, input.faults)
      }

      if (input.mrNumber !== undefined) {
        await this.mrRegistry.syncMrNumberChange(
          tx,
          ClaimKind.Emotive,
          id,
          before.mrNumber,
          input.mrNumber,
        )
      }
    })

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    return updated
  }

  async softDelete(id: string, actorId: string, before: EmotiveClaimDetail): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(emotiveClaims)
        .set({ deletedAt: new Date(), updatedBy: actorId })
        .where(and(eq(emotiveClaims.id, id), isNull(emotiveClaims.deletedAt)))
        .returning({ id: emotiveClaims.id })
      if (row === undefined) {
        throw new ConflictError(CONCURRENT_EDIT_MESSAGE)
      }

      await this.mrRegistry.releaseMr(before.mrNumber, tx)
    })
  }

  async restore(
    id: string,
    actorId: string,
    before: EmotiveClaimDetail,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(emotiveClaims)
        .set({ deletedAt: null, updatedBy: actorId })
        .where(and(eq(emotiveClaims.id, id), isNotNull(emotiveClaims.deletedAt)))
        .returning({ id: emotiveClaims.id })
      if (row === undefined) {
        throw new ConflictError(CONCURRENT_EDIT_MESSAGE)
      }

      await this.mrRegistry.claimMr(before.mrNumber, ClaimKind.Emotive, id, tx)
    })

    const restored = await this.findById(id, scope)
    if (restored === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    return restored
  }

  async changeOutcome(
    id: string,
    input: EmotiveClaimChangeOutcomeInput,
    actorId: string,
    before: EmotiveClaimDetail,
    scope: EmotiveClaimsListScope,
  ): Promise<EmotiveClaimDetail> {
    const resolvedAtPatch = outcomeResolvedAtForTransition(before.outcome, input.outcome)
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

    const [row] = await this.db
      .update(emotiveClaims)
      .set(patch)
      .where(
        and(
          eq(emotiveClaims.id, id),
          isNull(emotiveClaims.deletedAt),
          eq(emotiveClaims.outcome, before.outcome),
        ),
      )
      .returning({ id: emotiveClaims.id })
    if (row === undefined) {
      throw new ConflictError(CONCURRENT_EDIT_MESSAGE)
    }

    const updated = await this.findById(id, scope)
    if (updated === null) {
      throw new NotFoundError('Emotive claim', id)
    }

    return updated
  }

  /**
   * Gate B: the operator's explicit "Objavi/Publish" action. COALESCE keeps the
   * stamp monotonic — once set, a repeat call is a no-op at the DB level (the
   * service layer decides idempotency for audit/SSE using the before-read).
   */
  async publish(id: string, actorId: string): Promise<void> {
    const [row] = await this.db
      .update(emotiveClaims)
      .set({
        publishedAt: sql`COALESCE(${emotiveClaims.publishedAt}, now())`,
        // Phase 3 freshness: the reveal is itself a client-visible change.
        clientContentUpdatedAt: new Date(),
        // Phase 3.1: publish is Gate B — it belongs to the 'outcome' section.
        sectionUpdatedAt: this.bumpSectionsSql(['outcome']),
        updatedBy: actorId,
      })
      .where(and(eq(emotiveClaims.id, id), isNull(emotiveClaims.deletedAt)))
      .returning({ id: emotiveClaims.id })
    if (row === undefined) {
      throw new NotFoundError('Emotive claim', id)
    }
  }

  /**
   * Phase 3 freshness: stamps/advances the client's per-claim `viewed_at`.
   * Called only from the service's explicit `markClientSeen` (Task 1) — never
   * as a side effect of a read. Upsert on the composite PK so calling it again
   * never duplicate-key crashes — it just advances the timestamp.
   */
  async recordClientView(userId: string, claimId: string): Promise<void> {
    const now = new Date()
    await this.db
      .insert(emotiveClaimClientViews)
      .values({ userId, emotiveClaimId: claimId, viewedAt: now })
      .onConflictDoUpdate({
        target: [emotiveClaimClientViews.userId, emotiveClaimClientViews.emotiveClaimId],
        set: { viewedAt: now },
      })
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
