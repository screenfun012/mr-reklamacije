import {
  ChatEventType,
  ClaimEventType,
  NotificationEventType,
  ClaimKind,
  ClientSubmissionEventType,
  ResourceChangedKey,
  ResourceEventType,
} from '@mr/shared'
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

  it('parses claim lifecycle events', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ClaimEventType.Updated,
        payload: { kind: ClaimKind.Emotive, id: 'claim-1' },
      }),
    )

    expect(event).toEqual({
      type: ClaimEventType.Updated,
      payload: { kind: ClaimKind.Emotive, id: 'claim-1' },
    })
  })

  it('returns null for a claim event with a missing/invalid payload', () => {
    expect(
      parseAppEventFromSseData(JSON.stringify({ type: ClaimEventType.Updated, payload: {} })),
    ).toBeNull()
    expect(
      parseAppEventFromSseData(
        JSON.stringify({ type: ClaimEventType.Created, payload: { kind: 'nope', id: 'x' } }),
      ),
    ).toBeNull()
  })

  it('parses client-submission events', () => {
    const event = parseAppEventFromSseData(
      JSON.stringify({
        type: ClientSubmissionEventType.Changed,
        payload: { id: 'sub-1' },
      }),
    )

    expect(event).toEqual({
      type: ClientSubmissionEventType.Changed,
      payload: { id: 'sub-1' },
    })
  })

  it('returns null for a client-submission event with a missing id', () => {
    expect(
      parseAppEventFromSseData(
        JSON.stringify({ type: ClientSubmissionEventType.Changed, payload: {} }),
      ),
    ).toBeNull()
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

  it('invalidates the unified list, the kind list and the claim detail on a claim event', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ClaimEventType.Updated,
      payload: { kind: ClaimKind.Emotive, id: 'claim-9' },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['claims', 'list'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['emotive-claims', 'list'] })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['emotive-claims', 'detail', 'claim-9'],
    })
  })

  it('invalidates the dashboard summary on a claim event so the overview counts refresh', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ClaimEventType.Created,
      payload: { kind: ClaimKind.Emotive, id: 'claim-9' },
    })

    // The `dashboard` prefix, not one window: the summary is cached per chart window since the
    // endpoint took a `?months=` parameter, and naming a window would leave the others stale.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('invalidates the Inbox list and the changed submission on a client-submission event', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ClientSubmissionEventType.Changed,
      payload: { id: 'sub-1' },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['client-submissions', 'list'] })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['client-submissions', 'detail', 'sub-1'],
    })
  })

  it('invalidates the notification inbox on a notification event', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: NotificationEventType.Created,
      payload: { id: 'notif-1' },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] })
  })

  it('parses a notification event off the wire', () => {
    expect(
      parseAppEventFromSseData(
        JSON.stringify({ type: NotificationEventType.Created, payload: { id: 'notif-1' } }),
      ),
    ).toEqual({ type: NotificationEventType.Created, payload: { id: 'notif-1' } })
  })

  it('parses a chat message off the wire — an unlisted type is dropped in silence', () => {
    // The failure mode of a missing guard is nothing at all: the server publishes, the stream
    // delivers, and the screen never learns. That is why this asserts the parse, not the effect.
    const wire = JSON.stringify({
      type: ChatEventType.MessageCreated,
      payload: { conversationId: 'conv-1', messageId: 'msg-1' },
    })

    expect(parseAppEventFromSseData(wire)).toEqual({
      type: ChatEventType.MessageCreated,
      payload: { conversationId: 'conv-1', messageId: 'msg-1' },
    })
  })

  /**
   * ⚠ The pins as well. A pin and a like publish this same signal, and without that key somebody
   * else's pin leaves MY pinned bar showing the message before it — the mutation invalidates only
   * for the person who made it. Found in the browser with two accounts open, 2026-08-24.
   */
  it('refreshes the list, the open conversation AND its shortlist on a chat signal', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    handleAppEvent(queryClient, {
      type: ChatEventType.MessageCreated,
      payload: { conversationId: 'conv-1', messageId: 'msg-1' },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'conversations'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'messages', 'conv-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'pins', 'conv-1'] })
  })
})
