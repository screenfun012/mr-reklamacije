import { describe, expect, it } from 'vitest'

import { isIntakeConditionRecorded } from '../intake-condition-recorded.js'

describe('isIntakeConditionRecorded', () => {
  it('passes when the catalog has nothing to fill, so an office mistake never stops a handover', () => {
    // If the shop turned every item off, the car is still in the yard and the serviser has no way to
    // fix a catalog. The paper carries the empty-catalog sentence as proof instead.
    expect(isIntakeConditionRecorded({}, [], null, 0)).toBe(true)
    expect(isIntakeConditionRecorded({ rezervna: null }, [], null, 0)).toBe(true)
  })

  it('refuses a checklist nobody touched', () => {
    // The exact shape a fresh order carries: every catalog code seeded as null.
    expect(isIntakeConditionRecorded({ rezervna: null, dizalica: null }, [], null, 2)).toBe(false)
    expect(isIntakeConditionRecorded({}, [], null, 2)).toBe(false)
    expect(isIntakeConditionRecorded({ rezervna: null }, [], '', 2)).toBe(false)
  })

  it('accepts a single answer, DA or NE alike', () => {
    // NE is a statement too — "there was no jack in this car" is exactly what the paper is for.
    expect(isIntakeConditionRecorded({ rezervna: true, dizalica: null }, [], null, 2)).toBe(true)
    expect(isIntakeConditionRecorded({ rezervna: false, dizalica: null }, [], null, 2)).toBe(true)
  })

  it('accepts the equipment note on its own', () => {
    expect(isIntakeConditionRecorded({ rezervna: null }, [], 'Gepek pun alata', 1)).toBe(true)
  })

  it('does not accept a note of pure whitespace, which prints as nothing', () => {
    expect(isIntakeConditionRecorded({ rezervna: null }, [], '   \n ', 1)).toBe(false)
  })

  it('counts an answer on an item the shop has since retired', () => {
    // The order still prints that row under its own name, so the paper asserts something and the
    // rule is met — even though the code is no longer in the active catalog.
    expect(isIntakeConditionRecorded({ ugaseno: true }, [], null, 3)).toBe(true)
  })

  it('accepts a written-in row the serviser answered, which prints like any other', () => {
    // A row he typed in himself prints in the same band, in the same shape, and asserts the same
    // thing. A footer still saying "nothing is recorded" over an answered row on screen would be the
    // screen lying to the worker (docs/25 §3.0).
    const answered = [{ name: 'Gumeni patosnici', value: true }]
    const denied = [{ name: 'Gumeni patosnici', value: false }]

    expect(isIntakeConditionRecorded({ rezervna: null }, answered, null, 2)).toBe(true)
    expect(isIntakeConditionRecorded({ rezervna: null }, denied, null, 2)).toBe(true)
  })

  it('does not accept a written-in row nobody answered', () => {
    // Same third state as a catalog row: added is not answered. Typing a name is saying what to look
    // at, not saying what was found.
    expect(
      isIntakeConditionRecorded(
        { rezervna: null },
        [{ name: 'Gumeni patosnici', value: null }],
        null,
        2,
      ),
    ).toBe(false)
  })
})
