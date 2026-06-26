import { ResourceChangedKey, ResourceEventType } from '@mr/shared'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { handleAppEvent, parseAppEventFromSseData } from '../handle-app-event'

describe('parseAppEventFromSseData', () => {
  it('parses resource_changed events for users', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ResourceEventType.Changed,
        payload: { resource: ResourceChangedKey.Users },
      }),
    )

    expect(event).toEqual({
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.Users },
    })
  })

  it('returns null for malformed JSON', () => {
    expect(parseAppEventFromSseData('not-json')).toBeNull()
  })
})

describe('handleAppEvent', () => {
  it('invalidates users query prefix on resource_changed', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ResourceEventType.Changed,
      payload: { resource: ResourceChangedKey.Users },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})
