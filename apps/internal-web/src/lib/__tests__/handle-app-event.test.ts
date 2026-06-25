import { ResourceChangedKey, ResourceEventType } from '@mr/shared'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { handleAppEvent, parseAppEventFromSseData } from '../handle-app-event.js'

describe('parseAppEventFromSseData', () => {
  it('parses resource_changed events', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ResourceEventType.Changed,
        payload: { resource: ResourceChangedKey.EngineTypes },
      }),
    )

    expect(event).toEqual({
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.EngineTypes },
    })
  })

  it('parses resource_changed events for customers', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ResourceEventType.Changed,
        payload: { resource: ResourceChangedKey.Customers },
      }),
    )

    expect(event).toEqual({
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.Customers },
    })
  })

  it('parses resource_changed events for engine manufacturers', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ResourceEventType.Changed,
        payload: { resource: ResourceChangedKey.EngineManufacturers },
      }),
    )

    expect(event).toEqual({
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.EngineManufacturers },
    })
  })

  it('returns null for malformed JSON', () => {
    expect(parseAppEventFromSseData('not-json')).toBeNull()
  })
})

describe('handleAppEvent', () => {
  it('invalidates engine-types query prefix on resource_changed', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.EngineTypes },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['engine-types'] })
  })

  it('invalidates customers query prefix on resource_changed', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.Customers },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] })
  })

  it('invalidates engine-manufacturers query prefix on resource_changed', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.EngineManufacturers },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['engine-manufacturers'] })
  })
})
