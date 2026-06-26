import { describe, expect, it, vi } from 'vitest'

import { ValidationError } from '../../errors/domain-errors.js'
import { validateEngineTypeManufacturerPair } from '../validate-engine-type-manufacturer-pair.js'

describe('validateEngineTypeManufacturerPair', () => {
  it('passes when engine type manufacturer matches claim manufacturer', async () => {
    const getManufacturerId = vi.fn().mockResolvedValue('mfg-bmw')

    await expect(
      validateEngineTypeManufacturerPair(getManufacturerId, 'type-1', 'mfg-bmw'),
    ).resolves.toBeUndefined()
  })

  it('passes when engine type has no manufacturer FK (legacy orphan)', async () => {
    const getManufacturerId = vi.fn().mockResolvedValue(null)

    await expect(
      validateEngineTypeManufacturerPair(getManufacturerId, 'legacy-type', 'mfg-bmw'),
    ).resolves.toBeUndefined()
  })

  it('rejects when engine type belongs to a different manufacturer', async () => {
    const getManufacturerId = vi.fn().mockResolvedValue('mfg-bmw')

    await expect(
      validateEngineTypeManufacturerPair(getManufacturerId, 'type-1', 'mfg-audi'),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
