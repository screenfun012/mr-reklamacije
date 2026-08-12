import { and, count, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { intakeChecklistItems } from './intake-checklist-items.schema.js'
import type {
  IntakeChecklistItemCreateInput,
  IntakeChecklistItemListItem,
  IntakeChecklistItemsListQuery,
  IntakeChecklistItemUpdateInput,
  ReferenceListResponse,
} from './intake-checklist-items.validators.js'

export interface IntakeChecklistItemCreateResult {
  item: IntakeChecklistItemListItem
  /** The row as it stood before a retired code was revived onto it; `null` for a fresh insert. */
  revived: IntakeChecklistItemListItem | null
}

const ITEM_COLUMNS = {
  id: intakeChecklistItems.id,
  code: intakeChecklistItems.code,
  nameSr: intakeChecklistItems.nameSr,
  nameEn: intakeChecklistItems.nameEn,
  sortOrder: intakeChecklistItems.sortOrder,
  isActive: intakeChecklistItems.isActive,
} as const

export class IntakeChecklistItemsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(
    query: IntakeChecklistItemsListQuery,
  ): Promise<ReferenceListResponse<IntakeChecklistItemListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = []

    // Removed rows stay out of every read except the display path, which must resolve a name for
    // every code an order recorded (plan D3).
    if (!query.includeDeleted) {
      conditions.push(isNull(intakeChecklistItems.deletedAt))
    }

    if (query.activeOnly) {
      conditions.push(eq(intakeChecklistItems.isActive, true))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      const searchCondition = or(
        ilike(intakeChecklistItems.code, pattern),
        ilike(intakeChecklistItems.nameSr, pattern),
        ilike(intakeChecklistItems.nameEn, pattern),
      )
      if (searchCondition !== undefined) {
        conditions.push(searchCondition)
      }
    }

    const keysetCondition = keysetAfter(
      intakeChecklistItems.sortOrder,
      intakeChecklistItems.id,
      cursor,
    )
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select(ITEM_COLUMNS)
      .from(intakeChecklistItems)
      .where(and(...conditions))
      // The shop's own order, and the printed sheet keeps it (docs/25 §3.4) — never insertion order.
      .orderBy(intakeChecklistItems.sortOrder, intakeChecklistItems.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    return { items: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore }
  }

  /**
   * Every code the catalog holds, and deliberately WITHOUT the `is_active` and `deleted_at` filters
   * every other read here applies: this is what the intake guard checks a submitted checklist
   * against, and an order may already carry a code the shop retired since — refusing a correction to
   * such an order would make a signed document uncorrectable (plan D3). Only a code that exists
   * nowhere is unknown.
   *
   * Its own query rather than `list(...)`: it runs on every checklist-bearing patch, and one column
   * is materially cheaper than materialising full rows through the keyset pager.
   */
  async listKnownCodes(): Promise<string[]> {
    const rows = await this.db
      .select({ code: intakeChecklistItems.code })
      .from(intakeChecklistItems)

    return rows.map((row) => row.code)
  }

  /**
   * How many items a serviser can actually tick right now — the opposite read from `listKnownCodes`
   * above, and deliberately so: the signing guard asks whether there was anything to fill in at all,
   * and a catalog whose every item is retired must answer zero or it would lock the shop floor.
   */
  async countActiveItems(): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(intakeChecklistItems)
      .where(and(eq(intakeChecklistItems.isActive, true), isNull(intakeChecklistItems.deletedAt)))

    return row?.count ?? 0
  }

  async findById(id: string): Promise<IntakeChecklistItemListItem | null> {
    const [row] = await this.db
      .select(ITEM_COLUMNS)
      .from(intakeChecklistItems)
      .where(and(eq(intakeChecklistItems.id, id), isNull(intakeChecklistItems.deletedAt)))
      .limit(1)

    return row ?? null
  }

  async create(input: IntakeChecklistItemCreateInput): Promise<IntakeChecklistItemCreateResult> {
    // The unique index on `code` is NOT partial, so a soft-deleted row still holds its code. Look
    // past `deleted_at` here or re-adding a retired item hits a 23505 the caller cannot read.
    // Nested so the row's own columns stay one readable object while `deleted_at` rides alongside.
    const [existing] = await this.db
      .select({ item: ITEM_COLUMNS, deletedAt: intakeChecklistItems.deletedAt })
      .from(intakeChecklistItems)
      .where(eq(intakeChecklistItems.code, input.code))
      .limit(1)

    if (existing !== undefined && existing.deletedAt === null) {
      throw new ConflictError(`Stavka sa šifrom "${input.code}" već postoji.`)
    }

    // A retired item coming back is a revival, not a second row: old orders carrying this code get
    // their name back instead of printing a bare code (plan D3). The row's id survives, so the
    // caller is handed what it used to be — otherwise the old names leave no trace anywhere.
    if (existing !== undefined) {
      return { item: await this.revive(existing.item.id, input), revived: existing.item }
    }

    const [created] = await this.db
      .insert(intakeChecklistItems)
      .values({
        code: input.code,
        nameSr: input.nameSr,
        nameEn: input.nameEn,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      })
      .returning(ITEM_COLUMNS)

    if (created === undefined) {
      throw new InternalError('Failed to create intake checklist item')
    }

    return { item: created, revived: null }
  }

  private async revive(
    id: string,
    input: IntakeChecklistItemCreateInput,
  ): Promise<IntakeChecklistItemListItem> {
    const [revived] = await this.db
      .update(intakeChecklistItems)
      .set({
        nameSr: input.nameSr,
        nameEn: input.nameEn,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        deletedAt: null,
      })
      .where(eq(intakeChecklistItems.id, id))
      .returning(ITEM_COLUMNS)

    if (revived === undefined) {
      throw new InternalError('Failed to restore intake checklist item')
    }

    return revived
  }

  /** `code` is deliberately absent — an order stores it, so editing it would orphan the order. */
  async update(
    id: string,
    input: IntakeChecklistItemUpdateInput,
  ): Promise<IntakeChecklistItemListItem> {
    const [updated] = await this.db
      .update(intakeChecklistItems)
      .set({
        ...(input.nameSr !== undefined ? { nameSr: input.nameSr } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(intakeChecklistItems.id, id), isNull(intakeChecklistItems.deletedAt)))
      .returning(ITEM_COLUMNS)

    if (updated === undefined) {
      throw new NotFoundError('Intake checklist item', id)
    }

    return updated
  }

  async softDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .update(intakeChecklistItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(intakeChecklistItems.id, id), isNull(intakeChecklistItems.deletedAt)))
      .returning({ id: intakeChecklistItems.id })

    if (deleted === undefined) {
      throw new NotFoundError('Intake checklist item', id)
    }
  }
}
