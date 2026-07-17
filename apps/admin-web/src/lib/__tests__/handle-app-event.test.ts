import { ClaimEventType, ClaimKind, ResourceChangedKey, ResourceEventType } from '@mr/shared'
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

  it('parses claim lifecycle events (so the dashboard counts can live-update)', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ClaimEventType.Created,
        payload: { kind: ClaimKind.Emotive, id: 'claim-1' },
      }),
    )

    expect(event).toEqual({
      type: ClaimEventType.Created,
      payload: { kind: ClaimKind.Emotive, id: 'claim-1' },
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

  it('invalidates the dashboard summary on a claim event so the admin claim counts refresh', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ClaimEventType.Deleted,
      payload: { kind: ClaimKind.Domace, id: 'claim-1' },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'summary'] })
  })
})
