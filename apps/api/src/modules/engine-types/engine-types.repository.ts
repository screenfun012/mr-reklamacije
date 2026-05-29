import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { ConflictError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import {
  buildPaginatedSlice,
  parseOptionalKeysetCursor,
} from '../../core/utils/pagination.js'
import { engineTypes } from './engine-types.schema.js'
import type {
  EngineTypeCreateInput,
  EngineTypeListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './engine-types.validators.js'

interface EngineTypeRow {
  id: string
  code: string
  manufacturer: string | null
  displacementCc: number | null
  isActive: boolean
  usageCount: number
}

function mapEngineTypeRow(row: EngineTypeRow): EngineTypeListItem {
  return {
    id: row.id,
    code: row.code,
    manufacturer: row.manufacturer,
    displacementCc: row.displacementCc,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

export class EngineTypesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<EngineTypeListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(engineTypes.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(engineTypes.isActive, true))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(or(ilike(engineTypes.code, pattern), ilike(engineTypes.manufacturer, pattern))!)
    }

    const keysetCondition = keysetAfter(engineTypes.code, engineTypes.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: engineTypes.id,
        code: engineTypes.code,
        manufacturer: engineTypes.manufacturer,
        displacementCc: engineTypes.displacementCc,
        isActive: engineTypes.isActive,
        usageCount: engineTypes.usageCount,
      })
      .from(engineTypes)
      .where(and(...conditions))
      .orderBy(engineTypes.code, engineTypes.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.code,
      id: row.id,
    }))

    return {
      items: page.items.map(mapEngineTypeRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async create(input: EngineTypeCreateInput): Promise<EngineTypeListItem> {
    const [existing] = await this.db
      .select({ id: engineTypes.id })
      .from(engineTypes)
      .where(and(eq(engineTypes.code, input.code), isNull(engineTypes.deletedAt)))
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Engine type with code ${input.code} already exists`)
    }

    const [created] = await this.db
      .insert(engineTypes)
      .values({
        code: input.code,
        manufacturer: input.manufacturer ?? null,
        displacementCc: input.displacementCc ?? null,
        notes: input.notes ?? null,
        isActive: true,
        usageCount: 0,
      })
      .returning({
        id: engineTypes.id,
        code: engineTypes.code,
        manufacturer: engineTypes.manufacturer,
        displacementCc: engineTypes.displacementCc,
        isActive: engineTypes.isActive,
        usageCount: engineTypes.usageCount,
      })

    if (created === undefined) {
      throw new Error('Failed to create engine type')
    }

    return mapEngineTypeRow(created)
  }
}
