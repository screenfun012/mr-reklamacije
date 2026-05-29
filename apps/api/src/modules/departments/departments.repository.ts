import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import {
  buildPaginatedSlice,
  parseOptionalKeysetCursor,
} from '../../core/utils/pagination.js'
import { departments } from './departments.schema.js'
import type {
  DepartmentListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './departments.validators.js'

interface DepartmentRow {
  id: string
  code: string
  nameSr: string
  nameEn: string
  sortOrder: number
  isActive: boolean
}

function mapDepartmentRow(row: DepartmentRow): DepartmentListItem {
  return {
    id: row.id,
    code: row.code,
    nameSr: row.nameSr,
    nameEn: row.nameEn,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  }
}

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
      .select({
        id: departments.id,
        code: departments.code,
        nameSr: departments.nameSr,
        nameEn: departments.nameEn,
        sortOrder: departments.sortOrder,
        isActive: departments.isActive,
      })
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
}
