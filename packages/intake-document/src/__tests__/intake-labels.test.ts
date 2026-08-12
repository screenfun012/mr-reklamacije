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
})
