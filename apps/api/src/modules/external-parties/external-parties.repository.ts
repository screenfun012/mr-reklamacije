import { and, eq, ilike, isNull, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'
import { InternalError } from '../../core/errors/domain-errors.js'

import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { externalParties } from './external-parties.schema.js'
import type {
  ExternalPartyCreateInput,
  ExternalPartyListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './external-parties.validators.js'

interface ExternalPartyRow {
  id: string
  name: string
  kind: ExternalPartyListItem['kind']
  isActive: boolean
}

function mapExternalPartyRow(row: ExternalPartyRow): ExternalPartyListItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    isActive: row.isActive,
  }
}

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
      .select({
        id: externalParties.id,
        name: externalParties.name,
        kind: externalParties.kind,
        isActive: externalParties.isActive,
      })
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

  async create(input: ExternalPartyCreateInput): Promise<ExternalPartyListItem> {
    const [created] = await this.db
      .insert(externalParties)
      .values({
        name: input.name,
        kind: input.kind,
        isActive: true,
      })
      .returning({
        id: externalParties.id,
        name: externalParties.name,
        kind: externalParties.kind,
        isActive: externalParties.isActive,
      })

    if (created === undefined) {
      throw new InternalError('Failed to create external party')
    }

    return mapExternalPartyRow(created)
  }
}
