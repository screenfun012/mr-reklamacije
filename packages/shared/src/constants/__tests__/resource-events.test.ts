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

  it('maps engineManufacturers to its own prefix AND engine-types (denormalized manufacturer name)', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.EngineManufacturers)).toEqual([
      ['engine-manufacturers'],
      ['engine-types'],
    ])
  })

  it('maps departments to its own prefix AND employees (denormalized department name)', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.Departments)).toEqual([
      ['departments'],
      ['employees'],
    ])
  })

  it('maps users to users query prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.Users)).toEqual([['users']])
  })

  it('maps intakeOrders to the intake-orders prefix, covering list, KPI cards and detail', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.IntakeOrders)).toEqual([
      ['intake-orders'],
    ])
  })

  it('maps intakeChecklistItems to its own catalog prefix', () => {
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.IntakeChecklistItems)).toEqual([
      ['intake-checklist-items'],
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

  it('sends a category change to the counts as well as the catalogue', () => {
    // The sidebar's badges and the claim lists print category names; a rename or a retirement
    // that only reached the catalogue screens would leave both showing yesterday's answer.
    expect(queryKeyPrefixesForResourceChanged(ResourceChangedKey.ClaimCategories)).toEqual([
      ['claim-categories'],
      ['claim-category-fields'],
      ['claim-category-field-options'],
      ['claims', 'category-counts'],
    ])
  })
})
