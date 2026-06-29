import { and, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'
import { InternalError, NotFoundError } from '../../core/errors/domain-errors.js'

import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { externalParties } from './external-parties.schema.js'
import type {
  ExternalPartyCreateInput,
  ExternalPartyListItem,
  ExternalPartyUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './external-parties.validators.js'

/** Usage = fault attributions referencing this party (FK restrict on both fault tables). */
const externalPartyUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claim_faults
    WHERE emotive_claim_faults.external_party_id = external_parties.id
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int FROM domace_claim_faults
    WHERE domace_claim_faults.external_party_id = external_parties.id
  ), 0)
)`.mapWith(Number)

interface ExternalPartyRow {
  id: string
  name: string
  kind: ExternalPartyListItem['kind']
  isActive: boolean
  usageCount: number
}

function mapExternalPartyRow(row: ExternalPartyRow): ExternalPartyListItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

const EXTERNAL_PARTY_COLUMNS = {
  id: externalParties.id,
  name: externalParties.name,
  kind: externalParties.kind,
  isActive: externalParties.isActive,
} as const

export class ExternalPartiesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ExternalPartyListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(externalParties.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(externalParties.isActive, true))
    }

    if (query.search !== undefined) {
      conditions.push(ilike(externalParties.name, `%${query.search}%`))
    }

    const keysetCondition = keysetAfter(externalParties.name, externalParties.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({ ...EXTERNAL_PARTY_COLUMNS, usageCount: externalPartyUsageCountSql })
      .from(externalParties)
      .where(and(...conditions))
      .orderBy(externalParties.name, externalParties.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.name,
      id: row.id,
    }))

    return {
      items: page.items.map(mapExternalPartyRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<ExternalPartyListItem | null> {
    const [row] = await this.db
      .select({ ...EXTERNAL_PARTY_COLUMNS, usageCount: externalPartyUsageCountSql })
      .from(externalParties)
      .where(and(eq(externalParties.id, id), isNull(externalParties.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapExternalPartyRow(row)
  }

  async create(input: ExternalPartyCreateInput): Promise<ExternalPartyListItem> {
    const [created] = await this.db
      .insert(externalParties)
      .values({
        name: input.name,
        kind: input.kind,
        isActive: true,
      })
      .returning(EXTERNAL_PARTY_COLUMNS)

    if (created === undefined) {
      throw new InternalError('Failed to create external party')
    }

    return mapExternalPartyRow({ ...created, usageCount: 0 })
  }

  async update(id: string, input: ExternalPartyUpdateInput): Promise<ExternalPartyListItem> {
    const [updated] = await this.db
      .update(externalParties)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(externalParties.id, id), isNull(externalParties.deletedAt)))
      .returning(EXTERNAL_PARTY_COLUMNS)

    if (updated === undefined) {
      throw new NotFoundError('External party', id)
    }

    const usageCount = await this.getUsageCount(id)
    return mapExternalPartyRow({ ...updated, usageCount })
  }

  async getUsageCount(id: string): Promise<number> {
    const [row] = await this.db
      .select({ usageCount: externalPartyUsageCountSql })
      .from(externalParties)
      .where(and(eq(externalParties.id, id), isNull(externalParties.deletedAt)))
      .limit(1)

    return row?.usageCount ?? 0
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(externalParties)
      .where(and(eq(externalParties.id, id), isNull(externalParties.deletedAt)))
      .returning({ id: externalParties.id })

    if (deleted === undefined) {
      throw new NotFoundError('External party', id)
    }
  }
}
