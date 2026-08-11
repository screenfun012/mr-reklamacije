import { IntakeChecklistItemUpdateInputSchema } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { intakeChecklistResourceDefinition as def } from '../intake-checklist.definition.js'

const fullRow = {
  id: 'a3f6c1d2-1111-4b22-9c9d-000000000001',
  code: 'vozacka',
  nameSr: 'Vozačka dozvola',
  nameEn: "Driver's licence",
  sortOrder: '3',
}

const listItem = {
  id: 'a3f6c1d2-1111-4b22-9c9d-000000000001',
  code: 'vozacka',
  nameSr: 'Vozačka dozvola',
  nameEn: "Driver's licence",
  sortOrder: 3,
  isActive: false,
}

describe('intakeChecklistResourceDefinition columns', () => {
  it('shows exactly the columns the brief lists, in order', () => {
    expect(def.columns.map((column) => column.id)).toEqual([
      'code',
      'nameSr',
      'nameEn',
      'sortOrder',
      'isActive',
    ])
  })
})

describe('intakeChecklistResourceDefinition code is create-only', () => {
  it('never renders `code` as an editable field in the edit dialog', () => {
    const codeFieldsVisibleOnEdit = def.formFields.filter(
      (field) => field.key === 'code' && field.createOnly !== true,
    )

    // The edit-mode entry for `code` must exist (so the shop owner can still see it) but must be
    // `readonly` — the create-only entry is filtered out of the edit dialog by `createOnly: true`.
    expect(codeFieldsVisibleOnEdit).toHaveLength(1)
    expect(codeFieldsVisibleOnEdit[0]?.type).toBe('readonly')
  })

  /**
   * Pins the exact trap the control session hit: `use-resource-crud.ts` parses
   * `buildUpdateBody(values)`'s output through the `.strict()` update schema BEFORE sending it, so a
   * `code` (or `id`) riding along fails the parse client-side and the edit silently never reaches the
   * server. `buildUpdateBody` must never include either key, and the schema must accept what it does
   * produce.
   */
  it('buildUpdateBody carries neither `code` nor `id`, and the update schema accepts it', () => {
    const body = def.buildUpdateBody(fullRow)

    expect(body).not.toHaveProperty('code')
    expect(body).not.toHaveProperty('id')
    expect(() => IntakeChecklistItemUpdateInputSchema.parse(body)).not.toThrow()
  })
})

describe('intakeChecklistResourceDefinition lifecycle', () => {
  /**
   * Without a `lifecycle` block, `resource-table.tsx` falls back to `activeYesLabel()` for the
   * reactivate button on a retired row — the shop owner would see a button that just says "Da"
   * with no clue what it does. This catalog's delete has no usage guard by design (a code lives
   * inside every order's jsonb `checklist` map, so counting usage means scanning every order), so
   * `getUsageCount` truthfully returns 0 rather than the block being skipped.
   */
  it('declares a lifecycle block whose usage count is honestly zero', () => {
    expect(def.lifecycle).toBeDefined()
    expect(def.lifecycle?.getUsageCount(listItem)).toBe(0)
  })

  /**
   * The other seven catalogs' hard-delete copy says "permanently deleted, cannot be undone" — that
   * would be false for this catalog: the code stays readable on every order that already recorded
   * it, and re-creating the same code later revives the same row. The copy here must not borrow
   * that wording.
   */
  it('describes removal honestly instead of reusing the "cannot be undone" wording', () => {
    const description = def.lifecycle?.hardDeleteDescription(listItem) ?? ''

    expect(description).not.toContain('trajno')
    expect(description).not.toContain('ne može')
  })
})
