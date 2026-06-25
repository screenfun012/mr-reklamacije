import {
  ClaimEventType,
  ClaimKind,
  ResourceChangedKey,
  ResourceEventType,
  SYSTEM_ROLE_OPERATOR,
  type AppEvent,
} from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { InProcessEventBus } from '../in-process-event-bus.js'

const USER_ID = 'user-1'
const ROLES = [SYSTEM_ROLE_OPERATOR] as const

describe('InProcessEventBus', () => {
  let bus: InProcessEventBus

  beforeEach(() => {
    bus = new InProcessEventBus()
  })

  afterEach(() => {
    bus = new InProcessEventBus()
  })

  describe('when publishing claim_created', () => {
    it('delivers the event to a role subscriber', () => {
      const received: AppEvent[] = []
      const unsubscribe = bus.subscribeUser(USER_ID, ROLES, (event) => {
        received.push(event)
      })

      bus.publishClaimCreated({ kind: ClaimKind.Emotive, id: 'claim-1' })

      expect(received).toEqual([
        {
          type: ClaimEventType.Created,
          payload: { kind: ClaimKind.Emotive, id: 'claim-1' },
        },
      ])

      unsubscribe()
      expect(bus.listenerCount(USER_ID, ROLES)).toBe(0)
    })
  })

  describe('when unsubscribed', () => {
    it('stops delivering events and clears listeners', () => {
      const received: AppEvent[] = []
      const unsubscribe = bus.subscribeUser(USER_ID, ROLES, (event) => {
        received.push(event)
      })

      expect(bus.listenerCount(USER_ID, ROLES)).toBeGreaterThan(0)

      unsubscribe()
      bus.publishClaimUpdated({ kind: ClaimKind.Emotive, id: 'claim-2' })

      expect(received).toEqual([])
      expect(bus.listenerCount(USER_ID, ROLES)).toBe(0)
    })
  })

  describe('when publishing resource_changed', () => {
    it('delivers the event to operator role subscribers', () => {
      const received: AppEvent[] = []
      const unsubscribe = bus.subscribeUser(USER_ID, ROLES, (event) => {
        received.push(event)
      })

      bus.publishResourceChanged(ResourceChangedKey.EngineTypes)

      expect(received).toEqual([
        {
          type: ResourceEventType.Changed,
          payload: { resource: ResourceChangedKey.EngineTypes },
        },
      ])

      unsubscribe()
    })
  })

  describe('when publishing to a user channel', () => {
    it('delivers only to that user subscriber', () => {
      const received: AppEvent[] = []
      const unsubscribe = bus.subscribeUser(USER_ID, [], (event) => {
        received.push(event)
      })

      bus.publishToUser(USER_ID, {
        type: ClaimEventType.Deleted,
        payload: { kind: ClaimKind.Emotive, id: 'claim-3' },
      })

      expect(received).toHaveLength(1)
      unsubscribe()
    })
  })
})
