import { describe, expect, it } from 'vitest'

import type { AppEvent } from '../app-events.js'
import { ResourceChangedKey, ResourceEventType } from '../resource-events.js'
import { queryKeyPrefixesForResourceChanged } from '../resource-query-map.js'

describe('ResourceChangedKey', () => {
  it('maps customers to customers query prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.Customers)).toEqual([
      ['customers'],
    ])
  })

  it('maps engineTypes to engine-types query prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.EngineTypes)).toEqual([
      ['engine-types'],
    ])
  })

  it('maps engineManufacturers to engine-manufacturers query prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.EngineManufacturers)).toEqual([
      ['engine-manufacturers'],
    ])
  })

  it('maps users to users query prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.Users)).toEqual([['users']])
  })
})

describe('ResourceEventType', () => {
  it('uses snake_case SSE event name', () => {
    expect(ResourceEventType.Changed).toBe('resource_changed')
  })
})

describe('AppEvent union', () => {
  it('accepts resource_changed payload', () => {
    const event: AppEvent = {
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.EngineTypes },
    }
    expect(event.payload.resource).toBe('engineTypes')
  })
})
