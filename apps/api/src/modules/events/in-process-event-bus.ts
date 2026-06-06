import { EventEmitter } from 'node:events'

import {
  ClaimEventType,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  type AppEvent,
  type ClaimAppEvent,
  type ClaimEventPayload,
} from '@mr/shared'

import type { EventBus } from '../../core/ports/event-bus-port.js'

const CLAIM_LIST_ROLE_CHANNELS = [
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_ADMIN,
] as const

function userChannel(userId: string): string {
  return `user:${userId}`
}

function roleChannel(roleCode: string): string {
  return `role:${roleCode}`
}

/**
 * Single-process EventEmitter hub. Claim mutations fan out to operator/viewer/admin
 * role channels so open list views can invalidate via SSE.
 */
export class InProcessEventBus implements EventBus {
  private readonly emitter = new EventEmitter()

  publishClaimCreated(payload: ClaimEventPayload): void {
    this.publishClaimEvent(ClaimEventType.Created, payload)
  }

  publishClaimUpdated(payload: ClaimEventPayload): void {
    this.publishClaimEvent(ClaimEventType.Updated, payload)
  }

  publishClaimDeleted(payload: ClaimEventPayload): void {
    this.publishClaimEvent(ClaimEventType.Deleted, payload)
  }

  publishToUser(userId: string, event: AppEvent): void {
    this.emitter.emit(userChannel(userId), event)
  }

  publishToRole(roleCode: string, event: AppEvent): void {
    this.emitter.emit(roleChannel(roleCode), event)
  }

  subscribeUser(
    userId: string,
    roleCodes: readonly string[],
    listener: (event: AppEvent) => void,
  ): () => void {
    const channels = [userChannel(userId), ...roleCodes.map(roleChannel)]

    for (const channel of channels) {
      this.emitter.on(channel, listener)
    }

    return () => {
      for (const channel of channels) {
        this.emitter.off(channel, listener)
      }
    }
  }

  /** @internal Test-only introspection for subscriber cleanup. */
  listenerCount(userId: string, roleCodes: readonly string[]): number {
    const channels = [userChannel(userId), ...roleCodes.map(roleChannel)]
    return channels.reduce((sum, channel) => sum + this.emitter.listenerCount(channel), 0)
  }

  private publishClaimEvent(type: ClaimAppEvent['type'], payload: ClaimEventPayload): void {
    const event: ClaimAppEvent = { type, payload }
    for (const role of CLAIM_LIST_ROLE_CHANNELS) {
      this.publishToRole(role, event)
    }
  }
}
