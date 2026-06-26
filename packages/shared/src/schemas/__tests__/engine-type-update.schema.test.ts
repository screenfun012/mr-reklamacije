import { describe, expect, it } from 'vitest'

import { EngineTypeUpdateInputSchema } from '../reference-data.schema.js'

const MANUFACTURER_ID = '00000000-0000-4000-8000-000000000001'

describe('EngineTypeUpdateInputSchema', () => {
  it('accepts partial updates including notes', () => {
    const parsed = EngineTypeUpdateInputSchema.parse({
      manufacturerId: MANUFACTURER_ID,
      notes: 'OM651 variant',
    })
    expect(parsed).toEqual({
      manufacturerId: MANUFACTURER_ID,
      notes: 'OM651 variant',
    })
  })

  it('allows clearing nullable fields', () => {
    const parsed = EngineTypeUpdateInputSchema.parse({
      manufacturerId: null,
      notes: null,
      displacementCc: null,
    })
    expect(parsed.manufacturerId).toBeNull()
    expect(parsed.notes).toBeNull()
    expect(parsed.displacementCc).toBeNull()
  })

  it('rejects empty patch objects', () => {
    expect(() => EngineTypeUpdateInputSchema.parse({})).toThrow(/At least one field/)
  })
})
