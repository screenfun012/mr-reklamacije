import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { engineManufacturers } from './engine-manufacturers.schema.js'
import type {
  EngineManufacturerCreateInput,
  EngineManufacturerListItem,
  EngineManufacturerUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './engine-manufacturers.validators.js'

interface EngineManufacturerRow {
  id: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
}

function mapEngineManufacturerRow(row: EngineManufacturerRow): EngineManufacturerListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  }
}

export class EngineManufacturersRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(
    query: ReferenceListQuery,
  ): Promise<ReferenceListResponse<EngineManufacturerListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(engineManufacturers.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(engineManufacturers.isActive, true))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(
        or(ilike(engineManufacturers.code, pattern), ilike(engineManufacturers.name, pattern))!,
      )
    }

    const keysetCondition = keysetAfter(
      engineManufacturers.sortOrder,
      engineManufacturers.id,
      cursor,
    )
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: engineManufacturers.id,
        code: engineManufacturers.code,
        name: engineManufacturers.name,
        sortOrder: engineManufacturers.sortOrder,
        isActive: engineManufacturers.isActive,
      })
      .from(engineManufacturers)
      .where(and(...conditions))
      .orderBy(engineManufacturers.sortOrder, engineManufacturers.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    return {
      items: page.items.map(mapEngineManufacturerRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<EngineManufacturerListItem | null> {
    const [row] = await this.db
      .select({
        id: engineManufacturers.id,
        code: engineManufacturers.code,
        name: engineManufacturers.name,
        sortOrder: engineManufacturers.sortOrder,
        isActive: engineManufacturers.isActive,
      })
      .from(engineManufacturers)
      .where(and(eq(engineManufacturers.id, id), isNull(engineManufacturers.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapEngineManufacturerRow(row)
  }

  async create(input: EngineManufacturerCreateInput): Promise<EngineManufacturerListItem> {
    const [existing] = await this.db
      .select({ id: engineManufacturers.id })
      .from(engineManufacturers)
      .where(and(eq(engineManufacturers.code, input.code), isNull(engineManufacturers.deletedAt)))
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Engine manufacturer with code ${input.code} already exists`)
    }

    const [created] = await this.db
      .insert(engineManufacturers)
      .values({
        code: input.code,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      })
      .returning({
        id: engineManufacturers.id,
        code: engineManufacturers.code,
        name: engineManufacturers.name,
        sortOrder: engineManufacturers.sortOrder,
        isActive: engineManufacturers.isActive,
      })

    if (created === undefined) {
      throw new InternalError('Failed to create engine manufacturer')
    }

    return mapEngineManufacturerRow(created)
  }

  async update(
    id: string,
    input: EngineManufacturerUpdateInput,
  ): Promise<EngineManufacturerListItem> {
    const [updated] = await this.db
      .update(engineManufacturers)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(engineManufacturers.id, id), isNull(engineManufacturers.deletedAt)))
      .returning({
        id: engineManufacturers.id,
        code: engineManufacturers.code,
        name: engineManufacturers.name,
        sortOrder: engineManufacturers.sortOrder,
        isActive: engineManufacturers.isActive,
      })

    if (updated === undefined) {
      throw new NotFoundError('Engine manufacturer', id)
    }

    return mapEngineManufacturerRow(updated)
  }

  async softDelete(id: string): Promise<EngineManufacturerListItem> {
    const [deleted] = await this.db
      .update(engineManufacturers)
      .set({ deletedAt: new Date(), isActive: false })
      .where(and(eq(engineManufacturers.id, id), isNull(engineManufacturers.deletedAt)))
      .returning({
        id: engineManufacturers.id,
        code: engineManufacturers.code,
        name: engineManufacturers.name,
        sortOrder: engineManufacturers.sortOrder,
        isActive: engineManufacturers.isActive,
      })

    if (deleted === undefined) {
      throw new NotFoundError('Engine manufacturer', id)
    }

    return mapEngineManufacturerRow(deleted)
  }
}
