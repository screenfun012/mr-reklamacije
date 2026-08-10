import { describe, expect, it } from 'vitest'

import { IntakeDamageType } from '../../enums.js'
import type { IntakeChecklist, IntakeDamage } from '../../schemas/intake-order.schema.js'
import { sameIntakeChecklist, sameIntakeDamages } from '../intake-condition-equal.js'

const CHECKLIST: IntakeChecklist = {
  rezervna: true,
  dizalica: true,
  komplet: null,
  saobracajna: true,
  vozacka: null,
  prvaPomoc: false,
  prsluk: true,
  lanci: false,
}

const DAMAGE: IntakeDamage = {
  id: 'd1',
  type: IntakeDamageType.Scratch,
  x: 100,
  y: 60,
  zone: 'Prednja leva',
}

describe('sameIntakeChecklist', () => {
  it('sees an equal checklist as equal', () => {
    expect(sameIntakeChecklist(CHECKLIST, { ...CHECKLIST })).toBe(true)
  })

  it('separates an untouched row from a "no"', () => {
    expect(sameIntakeChecklist(CHECKLIST, { ...CHECKLIST, komplet: false })).toBe(false)
    expect(sameIntakeChecklist(CHECKLIST, { ...CHECKLIST, lanci: null })).toBe(false)
  })
})

describe('sameIntakeDamages', () => {
  it('sees a moved, retyped, added or removed marker', () => {
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE }])).toBe(true)
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, x: 101 }])).toBe(false)
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, y: 61 }])).toBe(false)
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, type: IntakeDamageType.Dent }])).toBe(false)
    expect(sameIntakeDamages([DAMAGE], [])).toBe(false)
    expect(sameIntakeDamages([], [DAMAGE])).toBe(false)
  })

  it('sees a rewritten note, which is a correction like any other', () => {
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, note: 'duboka' }])).toBe(false)
    expect(
      sameIntakeDamages([{ ...DAMAGE, note: 'duboka' }], [{ ...DAMAGE, note: 'duboka' }]),
    ).toBe(true)
  })

  it('sees two markers swapped, because the array order is the printed numbering', () => {
    const second: IntakeDamage = { ...DAMAGE, id: 'd2', x: 200 }

    expect(sameIntakeDamages([DAMAGE, second], [second, DAMAGE])).toBe(false)
  })

  it('ignores the zone, which the server derives from type and position', () => {
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, zone: 'Zadnja desna' }])).toBe(true)
  })
})
