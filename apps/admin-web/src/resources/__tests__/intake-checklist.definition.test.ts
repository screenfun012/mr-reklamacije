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
