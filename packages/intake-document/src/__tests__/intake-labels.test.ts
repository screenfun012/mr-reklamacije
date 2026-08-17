import { setLocale } from '@mr/i18n'
import { IntakeDamageType, intakeArrivalModeValues, intakeVehicleTypeValues } from '@mr/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  INTAKE_ARRIVAL_MODE_LABELS,
  INTAKE_DAMAGE_TYPE_LABELS,
  INTAKE_VEHICLE_TYPE_LABELS,
} from '../intake-labels.js'
import { formatIntakeReceivedAtLong } from '../intake-document-locale.js'

describe('intake labels', () => {
  it('gives every damage type a label', () => {
    // It joined this file from the wizard in Task 10 and skipped the guard the other three have.
    for (const type of Object.values(IntakeDamageType)) {
      expect(INTAKE_DAMAGE_TYPE_LABELS[type]()).not.toBe('')
    }
  })

  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  // The checklist items had a case here too, iterating a hardcoded list of eight keys. They are a
  // catalog the shop owns now, so there is no label map left to guard — the names come from the
  // database and `intake-checklist-catalog.test.ts` covers how a code resolves to one.

  it('names every vehicle type and every arrival mode', () => {
    for (const type of intakeVehicleTypeValues) {
      expect(INTAKE_VEHICLE_TYPE_LABELS[type]()).not.toBe('')
    }
    for (const mode of intakeArrivalModeValues) {
      expect(INTAKE_ARRIVAL_MODE_LABELS[mode]()).not.toBe('')
    }
  })

  it('carries the year, because the detail is read years later', () => {
    expect(formatIntakeReceivedAtLong('2026-07-25T07:14:00.000Z', 'sr')).toMatch(/2026/)
  })

  // `en` alone is US English: `Intl` renders 07/25/2026, month first, and a serviser reading a
  // work order cannot tell that from 07.25 in a hurry. `internal-format.ts` already learned this
  // the other way round — plain `sr` gave Cyrillic — and both intake formatters had missed it.
  it.each([
    ['sr', /^25\.07\.2026\.? · 09:14$/],
    ['en', /^25\/07\/2026 · 09:14$/],
  ])('writes the day before the month on %s, never the other way round', (locale, shape) => {
    expect(formatIntakeReceivedAtLong('2026-07-25T07:14:00.000Z', locale as 'sr' | 'en')).toMatch(
      shape,
    )
  })

  /**
   * The two above only caught this because CI runs in UTC; on a laptop set to Belgrade they passed
   * while the API — which renders the same sheet, on Railway, in UTC — printed the wrong hour.
   *
   * These two are the case that costs more than an hour: a car received just before midnight local
   * time is ALREADY the next day in Belgrade while UTC is still on the previous one, so an
   * unpinned formatter dates the owner's document a day early. Summer and winter both, so the fix
   * has to be the zone and not a hardcoded +2 — Belgrade is +1 in January.
   */
  it.each([
    ['summer', '2026-07-25T22:30:00.000Z', '26.07.2026. · 00:30'],
    ['winter', '2026-01-15T23:30:00.000Z', '16.01.2026. · 00:30'],
  ])(
    "writes %s times in the shop's zone, whatever the machine is set to",
    (_season, iso, shape) => {
      expect(formatIntakeReceivedAtLong(iso, 'sr')).toBe(shape)
    },
  )
})
