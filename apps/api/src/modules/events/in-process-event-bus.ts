import { EventEmitter } from 'node:events'

import {
  ClaimEventType,
  ClientSubmissionEventType,
  ResourceChangedKey,
  ResourceEventType,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  type AppEvent,
  type ClaimAppEvent,
  type ClaimEventPayload,
  type ClientSubmissionAppEvent,
  type ResourceChangedAppEvent,
} from '@mr/shared'

import type { EventBus } from '../../core/ports/event-bus-port.js'

const CLAIM_LIST_ROLE_CHANNELS = [
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  SYSTEM_ROLE_ADMIN,
] as const

const RESOURCE_SYNC_ROLE_CHANNELS = CLAIM_LIST_ROLE_CHANNELS

function userChannel(userId: string): string {
  return `user:${userId}`
}

function roleChannel(roleCode: string): string {
  return `role:${roleCode}`
}

function customerChannel(customerId: string): string {
  return `customer:${customerId}`
}

/**
 * Single-process EventEmitter hub. Claim mutations fan out to operator/viewer/admin
 * role channels so open list views can invalidate via SSE, and to the owning
 * customer's channel so portal clients get the same signal for THEIR claims
 * only — the event carries just `kind + id`, never any claim data.
 */
export class InProcessEventBus implements EventBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    // Every SSE connection adds a listener per role channel; Node's default
    // cap of 10 would log MaxListenersExceededWarning at 11 concurrent
    // same-role users. Listener cleanup is symmetric (see subscribeUser).
    this.emitter.setMaxListeners(0)
  }

  publishClaimCreated(payload: ClaimEventPayload, customerId?: string | null): void {
    this.publishClaimEvent(ClaimEventType.Created, payload, customerId)
  }

  publishClaimUpdated(payload: ClaimEventPayload, customerId?: string | null): void {
    this.publishClaimEvent(ClaimEventType.Updated, payload, customerId)
  }

  publishClaimDeleted(payload: ClaimEventPayload, customerId?: string | null): void {
    this.publishClaimEvent(ClaimEventType.Deleted, payload, customerId)
  }

  publishResourceChanged(resource: ResourceChangedKey): void {
    const event: ResourceChangedAppEvent = {
      type: ResourceEventType.Changed,
      payload: { resource },
    }
    for (const role of RESOURCE_SYNC_ROLE_CHANNELS) {
      this.publishToRole(role, event)
    }
  }

  publishClientSubmissionChanged(submissionId: string): void {
    // The Inbox is internal-only; fan out to the same internal role channels as
    // catalog sync so open Inbox lists + the badge invalidate (signal-only).
    const event: ClientSubmissionAppEvent = {
      type: ClientSubmissionEventType.Changed,
      payload: { id: submissionId },
    }
    for (const role of RESOURCE_SYNC_ROLE_CHANNELS) {
      this.publishToRole(role, event)
    }
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
    customerIds: readonly string[] = [],
  ): () => void {
    const channels = [
      userChannel(userId),
      ...roleCodes.map(roleChannel),
      ...customerIds.map(customerChannel),
    ]

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

  private publishClaimEvent(
    type: ClaimAppEvent['type'],
    payload: ClaimEventPayload,
    customerId?: string | null,
  ): void {
    const event: ClaimAppEvent = { type, payload }
    for (const role of CLAIM_LIST_ROLE_CHANNELS) {
      this.publishToRole(role, event)
    }
    if (customerId !== undefined && customerId !== null) {
      this.emitter.emit(customerChannel(customerId), event)
    }
  }
}
