import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { engineManufacturers, engineTypes } from './engine-types.schema.js'
import type {
  EngineTypeCreateInput,
  EngineTypeListItem,
  EngineTypeUpdateInput,
  EngineTypesListQuery,
  ReferenceListResponse,
} from './engine-types.validators.js'

interface EngineTypeRow {
  id: string
  code: string
  manufacturerId: string | null
  manufacturerName: string | null
  displacementCc: number | null
  notes: string | null
  isActive: boolean
  usageCount: number
}

function mapEngineTypeRow(row: EngineTypeRow): EngineTypeListItem {
  return {
    id: row.id,
    code: row.code,
    manufacturerId: row.manufacturerId,
    manufacturerName: row.manufacturerName,
    displacementCc: row.displacementCc,
    notes: row.notes,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

export class EngineTypesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: EngineTypesListQuery): Promise<ReferenceListResponse<EngineTypeListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(engineTypes.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(engineTypes.isActive, true))
    }

    if (query.manufacturerId !== undefined) {
      conditions.push(eq(engineTypes.manufacturerId, query.manufacturerId))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(
        or(ilike(engineTypes.code, pattern), ilike(engineManufacturers.name, pattern))!,
      )
    }

    const keysetCondition = keysetAfter(engineTypes.code, engineTypes.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: engineTypes.id,
        code: engineTypes.code,
        manufacturerId: engineTypes.manufacturerId,
        manufacturerName: engineManufacturers.name,
        displacementCc: engineTypes.displacementCc,
        notes: engineTypes.notes,
        isActive: engineTypes.isActive,
        usageCount: engineTypes.usageCount,
      })
      .from(engineTypes)
      .leftJoin(engineManufacturers, eq(engineTypes.manufacturerId, engineManufacturers.id))
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
        manufacturerId: input.manufacturerId,
        displacementCc: input.displacementCc ?? null,
        notes: input.notes ?? null,
        isActive: true,
        usageCount: 0,
      })
      .returning({
        id: engineTypes.id,
        code: engineTypes.code,
        manufacturerId: engineTypes.manufacturerId,
        displacementCc: engineTypes.displacementCc,
        notes: engineTypes.notes,
        isActive: engineTypes.isActive,
        usageCount: engineTypes.usageCount,
      })

    if (created === undefined) {
      throw new InternalError('Failed to create engine type')
    }

    const manufacturerName = await this.resolveManufacturerName(created.manufacturerId)
    return mapEngineTypeRow({ ...created, manufacturerName })
  }

  async findById(id: string): Promise<EngineTypeListItem | null> {
    const [row] = await this.db
      .select({
        id: engineTypes.id,
        code: engineTypes.code,
        manufacturerId: engineTypes.manufacturerId,
        manufacturerName: engineManufacturers.name,
        displacementCc: engineTypes.displacementCc,
        notes: engineTypes.notes,
        isActive: engineTypes.isActive,
        usageCount: engineTypes.usageCount,
      })
      .from(engineTypes)
      .leftJoin(engineManufacturers, eq(engineTypes.manufacturerId, engineManufacturers.id))
      .where(and(eq(engineTypes.id, id), isNull(engineTypes.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapEngineTypeRow(row)
  }

  async update(id: string, input: EngineTypeUpdateInput): Promise<EngineTypeListItem> {
    const [updated] = await this.db
      .update(engineTypes)
      .set({
        ...(input.manufacturerId !== undefined ? { manufacturerId: input.manufacturerId } : {}),
        ...(input.displacementCc !== undefined ? { displacementCc: input.displacementCc } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(engineTypes.id, id), isNull(engineTypes.deletedAt)))
      .returning({
        id: engineTypes.id,
        code: engineTypes.code,
        manufacturerId: engineTypes.manufacturerId,
        displacementCc: engineTypes.displacementCc,
        notes: engineTypes.notes,
        isActive: engineTypes.isActive,
        usageCount: engineTypes.usageCount,
      })

    if (updated === undefined) {
      throw new NotFoundError('Engine type', id)
    }

    const manufacturerName = await this.resolveManufacturerName(updated.manufacturerId)
    return mapEngineTypeRow({ ...updated, manufacturerName })
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(engineTypes)
      .where(and(eq(engineTypes.id, id), isNull(engineTypes.deletedAt)))
      .returning({ id: engineTypes.id })

    if (deleted === undefined) {
      throw new NotFoundError('Engine type', id)
    }
  }

  private async resolveManufacturerName(manufacturerId: string | null): Promise<string | null> {
    if (manufacturerId === null) {
      return null
    }

    const [row] = await this.db
      .select({ name: engineManufacturers.name })
      .from(engineManufacturers)
      .where(and(eq(engineManufacturers.id, manufacturerId), isNull(engineManufacturers.deletedAt)))
      .limit(1)

    return row?.name ?? null
  }
}
