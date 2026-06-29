import { and, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { departments } from './departments.schema.js'
import type {
  DepartmentCreateInput,
  DepartmentListItem,
  DepartmentUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './departments.validators.js'

/** Usage = fault attributions (FK restrict) + employees (FK set null, but still "in use"). */
const departmentUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claim_faults
    WHERE emotive_claim_faults.department_id = departments.id
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claim_faults
    WHERE domace_claim_faults.department_id = departments.id
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM employees
    WHERE employees.department_id = departments.id AND employees.deleted_at IS NULL
  ), 0)
)`.mapWith(Number)

interface DepartmentRow {
  id: string
  code: string
  nameSr: string
  nameEn: string
  sortOrder: number
  isActive: boolean
  usageCount: number
}

function mapDepartmentRow(row: DepartmentRow): DepartmentListItem {
  return {
    id: row.id,
    code: row.code,
    nameSr: row.nameSr,
    nameEn: row.nameEn,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

const DEPARTMENT_COLUMNS = {
  id: departments.id,
  code: departments.code,
  nameSr: departments.nameSr,
  nameEn: departments.nameEn,
  sortOrder: departments.sortOrder,
  isActive: departments.isActive,
} as const

export class DepartmentsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<DepartmentListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(departments.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(departments.isActive, true))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(
        or(
          ilike(departments.code, pattern),
          ilike(departments.nameSr, pattern),
          ilike(departments.nameEn, pattern),
        )!,
      )
    }

    const keysetCondition = keysetAfter(departments.sortOrder, departments.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({ ...DEPARTMENT_COLUMNS, usageCount: departmentUsageCountSql })
      .from(departments)
      .where(and(...conditions))
      .orderBy(departments.sortOrder, departments.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    return {
      items: page.items.map(mapDepartmentRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<DepartmentListItem | null> {
    const [row] = await this.db
      .select({ ...DEPARTMENT_COLUMNS, usageCount: departmentUsageCountSql })
      .from(departments)
      .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapDepartmentRow(row)
  }

  async create(input: DepartmentCreateInput): Promise<DepartmentListItem> {
    const [existing] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.code, input.code), isNull(departments.deletedAt)))
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Odeljenje sa šifrom "${input.code}" već postoji.`)
    }

    const [created] = await this.db
      .insert(departments)
      .values({
        code: input.code,
        nameSr: input.nameSr,
        nameEn: input.nameEn,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      })
      .returning(DEPARTMENT_COLUMNS)

    if (created === undefined) {
      throw new InternalError('Failed to create department')
    }

    return mapDepartmentRow({ ...created, usageCount: 0 })
  }

  async update(id: string, input: DepartmentUpdateInput): Promise<DepartmentListItem> {
    const [updated] = await this.db
      .update(departments)
      .set({
        ...(input.nameSr !== undefined ? { nameSr: input.nameSr } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
      .returning(DEPARTMENT_COLUMNS)

    if (updated === undefined) {
      throw new NotFoundError('Department', id)
    }

    const usageCount = await this.getUsageCount(id)
    return mapDepartmentRow({ ...updated, usageCount })
  }

  async getUsageCount(id: string): Promise<number> {
    const [row] = await this.db
      .select({ usageCount: departmentUsageCountSql })
      .from(departments)
      .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
      .limit(1)

    return row?.usageCount ?? 0
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(departments)
      .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
      .returning({ id: departments.id })

    if (deleted === undefined) {
      throw new NotFoundError('Department', id)
    }
  }
}
