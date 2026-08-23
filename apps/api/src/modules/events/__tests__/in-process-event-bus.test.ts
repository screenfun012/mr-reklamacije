import {
  ClaimEventType,
  ClaimKind,
  ResourceChangedKey,
  ResourceEventType,
  SYSTEM_ROLE_CLIENT,
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

  describe('customer channels (portal clients)', () => {
    it('delivers claim events to the owning customer only, without leaking customerId', () => {
      const received: AppEvent[] = []
      const other: AppEvent[] = []
      const unsubscribeOwn = bus.subscribeUser('client-1', [], (event) => received.push(event), [
        'customer-a',
      ])
      const unsubscribeOther = bus.subscribeUser('client-2', [], (event) => other.push(event), [
        'customer-b',
      ])

      bus.publishClaimUpdated({ kind: ClaimKind.Emotive, id: 'claim-9' }, 'customer-a')

      expect(other).toEqual([])
      expect(received).toEqual([
        {
          type: ClaimEventType.Updated,
          payload: { kind: ClaimKind.Emotive, id: 'claim-9' },
        },
      ])

      unsubscribeOwn()
      unsubscribeOther()
    })

    it('skips the customer channel when no customerId is provided', () => {
      const received: AppEvent[] = []
      const unsubscribe = bus.subscribeUser('client-1', [], (event) => received.push(event), [
        'customer-a',
      ])

      bus.publishClaimUpdated({ kind: ClaimKind.Domace, id: 'claim-10' })

      expect(received).toEqual([])
      unsubscribe()
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

  describe('when publishing a chat message', () => {
    function collect(roles: readonly string[]): { received: AppEvent[]; stop: () => void } {
      const received: AppEvent[] = []
      const stop = bus.subscribeUser(`u-${roles.join('-')}`, roles, (event) => {
        received.push(event)
      })
      return { received, stop }
    }

    it('reaches a role the office invented in the admin panel', () => {
      // Roles are DATA here — the "samo Statistika" account is real (CLAUDE.md §2). Addressing
      // chat by a fixed list of role codes would leave such an account in a chat that never
      // updates until it reloads, which is not a late badge but a broken chat.
      const office = collect(['statistika'])
      bus.publishChatMessageCreated('conv-1', 'msg-1')
      office.stop()

      expect(office.received).toEqual([
        { type: 'chat_message_created', payload: { conversationId: 'conv-1', messageId: 'msg-1' } },
      ])
    })

    it('reaches the ordinary internal roles too', () => {
      const operator = collect([SYSTEM_ROLE_OPERATOR])
      bus.publishChatMessageCreated('conv-2', 'msg-2')
      operator.stop()

      expect(operator.received).toHaveLength(1)
    })

    it('never reaches a portal client — he must not learn a conversation exists', () => {
      const client = collect([SYSTEM_ROLE_CLIENT])
      bus.publishChatMessageCreated('conv-3', 'msg-3')
      client.stop()

      expect(client.received).toEqual([])
    })

    it('reaches an account that is a client AND something else', () => {
      // The combination is refused at approval today, but the bus must not be the thing that
      // decides who is internal — it asks whether ANY role is not `client`.
      const both = collect([SYSTEM_ROLE_CLIENT, SYSTEM_ROLE_OPERATOR])
      bus.publishChatMessageCreated('conv-4', 'msg-4')
      both.stop()

      expect(both.received).toHaveLength(1)
    })
  })
})
