import { setLocale } from '@mr/i18n'
import { INTAKE_CHECKLIST_KEYS, intakeArrivalModeValues, intakeVehicleTypeValues } from '@mr/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  INTAKE_ARRIVAL_MODE_LABELS,
  INTAKE_CHECKLIST_LABELS,
  INTAKE_VEHICLE_TYPE_LABELS,
} from '../intake-labels.js'
import { formatIntakeReceivedAtLong } from '../intake-status.js'

describe('intake labels', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('names every checklist item exactly once', () => {
    for (const key of INTAKE_CHECKLIST_KEYS) {
      expect(INTAKE_CHECKLIST_LABELS[key]()).not.toBe('')
    }
  })

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
})
