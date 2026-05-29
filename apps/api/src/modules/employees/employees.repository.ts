import { normalizeName } from '@mr/shared'
import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import {
  buildPaginatedSlice,
  parseOptionalKeysetCursor,
} from '../../core/utils/pagination.js'
import { employees } from './employees.schema.js'
import type { EmployeeListItem, EmployeesListQuery, ReferenceListResponse } from './employees.validators.js'

interface EmployeeRow {
  id: string
  fullName: string
  isActive: boolean
  departmentId: string | null
  normalizedName: string
}

function mapEmployeeRow(row: EmployeeRow): EmployeeListItem {
  return {
    id: row.id,
    full_name: row.fullName,
    is_active: row.isActive,
    department_id: row.departmentId,
  }
}
function buildSearchCondition(search: string | undefined): SQL | undefined {
  if (search === undefined) {
    return undefined
  }

  const pattern = `%${search}%`
  const normalized = normalizeName(search)

  return or(
    ilike(employees.fullName, pattern),
    ilike(employees.normalizedName, `%${normalized}%`),
  )
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
        id: employees.id,
        fullName: employees.fullName,
        isActive: employees.isActive,
        departmentId: employees.departmentId,
        normalizedName: employees.normalizedName,
      })
      .from(employees)
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
}
