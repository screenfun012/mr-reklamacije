import { describe, expect, it } from 'vitest'

import type { AppEvent } from '../app-events.js'
import { ResourceChangedKey, ResourceEventType } from '../resource-events.js'
import { queryKeyPrefixesForResourceChanged } from '../resource-query-map.js'

describe('ResourceChangedKey', () => {
  it('maps engineTypes to engine-types query prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.EngineTypes)).toEqual([
      ['engine-types'],
    ])
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
