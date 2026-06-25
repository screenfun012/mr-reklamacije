import { describe, expect, it } from 'vitest'

import {
  CustomerCreateInputSchema,
  CustomerListItemSchema,
  CustomerUpdateInputSchema,
} from '../reference-data.schema.js'

describe('CustomerCreateInputSchema', () => {
  it('accepts name with optional country and city', () => {
    const parsed = CustomerCreateInputSchema.parse({
      name: 'NEWPARTS',
      country: 'NL',
      city: 'Amsterdam',
    })
    expect(parsed).toEqual({
      name: 'NEWPARTS',
      country: 'NL',
      city: 'Amsterdam',
    })
  })

  it('rejects empty name', () => {
    expect(() => CustomerCreateInputSchema.parse({ name: '   ' })).toThrow()
  })
})

describe('CustomerUpdateInputSchema', () => {
  it('accepts partial updates including isActive toggle', () => {
    const parsed = CustomerUpdateInputSchema.parse({
      name: 'HILLS',
      isActive: false,
    })
    expect(parsed).toEqual({ name: 'HILLS', isActive: false })
  })

  it('allows clearing nullable location fields', () => {
    const parsed = CustomerUpdateInputSchema.parse({
      country: null,
      city: null,
    })
    expect(parsed.country).toBeNull()
    expect(parsed.city).toBeNull()
  })

  it('rejects empty patch objects', () => {
    expect(() => CustomerUpdateInputSchema.parse({})).toThrow(/At least one field/)
  })
})

describe('CustomerListItemSchema', () => {
  it('includes usageCount', () => {
    const parsed = CustomerListItemSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'HILLS',
      kind: 'emotive_partner',
      country: null,
      city: null,
      isActive: true,
      usageCount: 3,
    })
    expect(parsed.usageCount).toBe(3)
  })
})
