import { normalizeName } from '@mr/shared'
import { and, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { departments, employees } from './employees.schema.js'
import type {
  EmployeeCreateInput,
  EmployeeListItem,
  EmployeesListQuery,
  EmployeeUpdateInput,
  ReferenceListResponse,
} from './employees.validators.js'

/** Usage = fault attributions that reference this employee (blocks hard delete). */
const employeeUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claim_faults
    WHERE emotive_claim_faults.employee_id = employees.id
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claim_faults
    WHERE domace_claim_faults.employee_id = employees.id
  ), 0)
)`.mapWith(Number)

interface EmployeeRow {
  id: string
  fullName: string
  isActive: boolean
  departmentId: string | null
  departmentName: string | null
  usageCount: number
}

function mapEmployeeRow(row: EmployeeRow): EmployeeListItem {
  return {
    id: row.id,
    fullName: row.fullName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

const EMPLOYEE_COLUMNS = {
  id: employees.id,
  fullName: employees.fullName,
  isActive: employees.isActive,
  departmentId: employees.departmentId,
  departmentName: departments.nameSr,
} as const

function buildSearchCondition(search: string | undefined): SQL | undefined {
  if (search === undefined) {
    return undefined
  }

  const pattern = `%${search}%`
  const normalized = normalizeName(search)

  return or(ilike(employees.fullName, pattern), ilike(employees.normalizedName, `%${normalized}%`))
}

export class EmployeesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: EmployeesListQuery): Promise<ReferenceListResponse<EmployeeListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(employees.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(employees.isActive, true))
    }

    if (query.departmentId !== undefined) {
      conditions.push(eq(employees.departmentId, query.departmentId))
    }

    const searchCondition = buildSearchCondition(query.search)
    if (searchCondition !== undefined) {
      conditions.push(searchCondition)
    }

    const keysetCondition = keysetAfter(employees.normalizedName, employees.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        ...EMPLOYEE_COLUMNS,
        normalizedName: employees.normalizedName,
        usageCount: employeeUsageCountSql,
      })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(and(...conditions))
      .orderBy(employees.normalizedName, employees.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.normalizedName,
      id: row.id,
    }))

    return {
      items: page.items.map(mapEmployeeRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<EmployeeListItem | null> {
    const [row] = await this.db
      .select({ ...EMPLOYEE_COLUMNS, usageCount: employeeUsageCountSql })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapEmployeeRow(row)
  }

  async create(input: EmployeeCreateInput): Promise<EmployeeListItem> {
    const normalizedName = normalizeName(input.fullName)

    const [existing] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.normalizedName, normalizedName), isNull(employees.deletedAt)))
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Radnik "${input.fullName}" već postoji.`)
    }

    const [created] = await this.db
      .insert(employees)
      .values({
        fullName: input.fullName,
        normalizedName,
        departmentId: input.departmentId ?? null,
        isActive: true,
      })
      .returning({ id: employees.id })

    if (created === undefined) {
      throw new InternalError('Failed to create employee')
    }

    const item = await this.findById(created.id)
    if (item === null) {
      throw new InternalError('Failed to load created employee')
    }
    return item
  }

  async update(id: string, input: EmployeeUpdateInput): Promise<EmployeeListItem> {
    const [updated] = await this.db
      .update(employees)
      .set({
        ...(input.fullName !== undefined
          ? { fullName: input.fullName, normalizedName: normalizeName(input.fullName) }
          : {}),
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .returning({ id: employees.id })

    if (updated === undefined) {
      throw new NotFoundError('Employee', id)
    }

    const item = await this.findById(id)
    if (item === null) {
      throw new NotFoundError('Employee', id)
    }
    return item
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(employees)
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .returning({ id: employees.id })

    if (deleted === undefined) {
      throw new NotFoundError('Employee', id)
    }
  }
}
