import { describe, expect, it } from 'vitest'

import {
  INTAKE_CHECKLIST_CODE_MAX,
  INTAKE_CHECKLIST_MAX_ITEMS,
  IntakeChecklistSchema,
} from '../intake-order.schema.js'

/*
 * The wire no longer names the codes. It used to be a closed object of exactly eight keys, which
 * meant the shop could add a ninth item in admin and the app could not store it: a wizard patch
 * either 422'd on the missing key and stalled the intake at step 1, or had the new item silently
 * stripped. Which codes exist is the catalog's judgement and the service makes it (spec ⑭) — all the
 * schema decides is that a key is a usable code and that the map has a ceiling.
 */
describe('IntakeChecklistSchema accepts what the catalog can hold', () => {
  it('accepts a code the original eight never had', () => {
    const checklist = { rezervna: true, patosnici: false }
    expect(IntakeChecklistSchema.parse(checklist)).toEqual(checklist)
  })

  it('accepts an empty map, so a shop whose catalog is empty can still leave step 1', () => {
    expect(IntakeChecklistSchema.parse({})).toEqual({})
  })

  it('keeps untouched apart from NE — the third state is what prints as a dash', () => {
    const checklist = { rezervna: null, dizalica: false, lanci: true }
    expect(IntakeChecklistSchema.parse(checklist)).toEqual(checklist)
  })

  it('accepts a code exactly at the length cap', () => {
    const code = `a${'b'.repeat(INTAKE_CHECKLIST_CODE_MAX - 1)}`
    expect(IntakeChecklistSchema.parse({ [code]: true })).toEqual({ [code]: true })
  })

  it('accepts a map exactly at the item cap', () => {
    const full = Object.fromEntries(
      Array.from({ length: INTAKE_CHECKLIST_MAX_ITEMS }, (_, index) => [`item_${index}`, null]),
    )
    expect(IntakeChecklistSchema.parse(full)).toEqual(full)
  })
})

describe('IntakeChecklistSchema still refuses what is not a checklist', () => {
  it('refuses a key that is not a usable code', () => {
    for (const key of ['', ' ', '9lives', 'ima razmak', 'crta-u-sredini', 'sa.tackom']) {
      expect(IntakeChecklistSchema.safeParse({ [key]: true }).success).toBe(false)
    }
  })

  it('refuses a code over the length cap', () => {
    const tooLong = `a${'b'.repeat(INTAKE_CHECKLIST_CODE_MAX)}`
    expect(IntakeChecklistSchema.safeParse({ [tooLong]: true }).success).toBe(false)
  })

  it('refuses anything but DA, NE and untouched as a value', () => {
    for (const value of ['true', 1, undefined, {}]) {
      expect(IntakeChecklistSchema.safeParse({ rezervna: value }).success).toBe(false)
    }
  })

  // The map lands in a jsonb column, so "any code" must not also mean "any number of them".
  it('refuses a map over the item cap', () => {
    const oversized = Object.fromEntries(
      Array.from({ length: INTAKE_CHECKLIST_MAX_ITEMS + 1 }, (_, index) => [`item_${index}`, null]),
    )
    expect(IntakeChecklistSchema.safeParse(oversized).success).toBe(false)
  })
})
