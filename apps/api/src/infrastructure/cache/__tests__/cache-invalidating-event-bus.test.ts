import { ClaimKind, ResourceChangedKey, type ClaimEventPayload } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import type { EventBus } from '../../../core/ports/event-bus-port.js'
import type { SummaryCache } from '../summary-cache.js'
import { CacheInvalidatingEventBus } from '../cache-invalidating-event-bus.js'

class RecordingBus implements EventBus {
  readonly calls: string[] = []
  publishClaimCreated(): void {
    this.calls.push('created')
  }
  publishClaimUpdated(): void {
    this.calls.push('updated')
  }
  publishClaimDeleted(): void {
    this.calls.push('deleted')
  }
  publishResourceChanged(): void {
    this.calls.push('resource')
  }
  publishClientSubmissionChanged(): void {
    this.calls.push('submission')
  }
  publishNotificationCreated(): void {
    this.calls.push('notification')
  }
  publishChatMessageCreated(): void {
    this.calls.push('chat')
  }
  subscribeUser(): () => void {
    this.calls.push('subscribe')
    return () => {}
  }
}

// invalidate() increments synchronously (no await before the bump), so the counter is
// observable immediately after each fire-and-forget publish call.
class CountingSummaryCache {
  invalidations = 0
  async invalidate(): Promise<void> {
    this.invalidations += 1
  }
}

const payload: ClaimEventPayload = { kind: ClaimKind.Emotive, id: 'c1' }

describe('CacheInvalidatingEventBus', () => {
  it('invalidates the summary cache on every claim mutation and delegates', () => {
    const inner = new RecordingBus()
    const cache = new CountingSummaryCache()
    const bus = new CacheInvalidatingEventBus(inner, cache as unknown as SummaryCache)

    bus.publishClaimCreated(payload)
    bus.publishClaimUpdated(payload)
    bus.publishClaimDeleted(payload)

    expect(cache.invalidations).toBe(3)
    expect(inner.calls).toEqual(['created', 'updated', 'deleted'])
  })

  it('does NOT invalidate on non-claim signals but still delegates them', () => {
    const inner = new RecordingBus()
    const cache = new CountingSummaryCache()
    const bus = new CacheInvalidatingEventBus(inner, cache as unknown as SummaryCache)

    bus.publishResourceChanged(ResourceChangedKey.Users)
    bus.publishClientSubmissionChanged('s1')
    bus.publishNotificationCreated('u1', 'n1')
    bus.subscribeUser('u1', ['admin'], () => {})

    expect(cache.invalidations).toBe(0)
    expect(inner.calls).toEqual(['resource', 'submission', 'notification', 'subscribe'])
  })
})
