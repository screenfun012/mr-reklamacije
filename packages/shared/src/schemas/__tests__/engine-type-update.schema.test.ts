import { describe, expect, it } from 'vitest'

import { EngineTypeUpdateInputSchema } from '../reference-data.schema.js'

describe('EngineTypeUpdateInputSchema', () => {
  it('accepts partial updates including notes', () => {
    const parsed = EngineTypeUpdateInputSchema.parse({
      manufacturer: 'Mercedes-Benz',
      notes: 'OM651 variant',
    })
    expect(parsed).toEqual({
      manufacturer: 'Mercedes-Benz',
      notes: 'OM651 variant',
    })
  })

  it('allows clearing nullable fields', () => {
    const parsed = EngineTypeUpdateInputSchema.parse({
      manufacturer: null,
      notes: null,
      displacementCc: null,
    })
    expect(parsed.manufacturer).toBeNull()
    expect(parsed.notes).toBeNull()
    expect(parsed.displacementCc).toBeNull()
  })

  it('rejects empty patch objects', () => {
    expect(() => EngineTypeUpdateInputSchema.parse({})).toThrow(/At least one field/)
  })
})
