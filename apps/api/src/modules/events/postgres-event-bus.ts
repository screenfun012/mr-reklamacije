import { ClaimKind, ResourceChangedKey, type AppEvent, type ClaimEventPayload } from '@mr/shared'
import type { Logger } from '@mr/logger'
import pg from 'pg'
import { z } from 'zod'

import type { EventBus } from '../../core/ports/event-bus-port.js'
import { InProcessEventBus } from './in-process-event-bus.js'

const CHANNEL = 'mr_events'
const INITIAL_BACKOFF_MS = 250
const MAX_BACKOFF_MS = 10_000

/**
 * Transport tags for the NOTIFY payload — deliberately distinct from the SSE wire
 * event types (`ClaimEventType.Created` = `'claim_created'`). Local to this module:
 * the transport shape never crosses to the frontend, so it does NOT live in `@mr/shared`.
 */
const NotifyKind = {
  ClaimCreated: 'claimCreated',
  ClaimUpdated: 'claimUpdated',
  ClaimDeleted: 'claimDeleted',
  ResourceChanged: 'resourceChanged',
  ClientSubmissionChanged: 'clientSubmissionChanged',
  NotificationCreated: 'notificationCreated',
} as const

const claimEventPayloadSchema = z.object({
  kind: z.enum(ClaimKind),
  id: z.string(),
})

const NotifyMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(NotifyKind.ClaimCreated),
    payload: claimEventPayloadSchema,
    customerId: z.string().nullish(),
  }),
  z.object({
    kind: z.literal(NotifyKind.ClaimUpdated),
    payload: claimEventPayloadSchema,
    customerId: z.string().nullish(),
  }),
  z.object({
    kind: z.literal(NotifyKind.ClaimDeleted),
    payload: claimEventPayloadSchema,
    customerId: z.string().nullish(),
  }),
  z.object({
    kind: z.literal(NotifyKind.ResourceChanged),
    resource: z.enum(ResourceChangedKey),
  }),
  z.object({
    kind: z.literal(NotifyKind.ClientSubmissionChanged),
    submissionId: z.string(),
  }),
  // `userId` travels so the RECEIVING replica knows whose user channel to fan out on —
  // same routing role `customerId` plays for claim events. Still signal-only.
  z.object({
    kind: z.literal(NotifyKind.NotificationCreated),
    userId: z.string(),
    notificationId: z.string(),
  }),
])

export type NotifyMessage = z.infer<typeof NotifyMessageSchema>

/**
 * Replica-safe `EventBus` transport over Postgres `LISTEN/NOTIFY` (design:
 * `docs/superpowers/specs/2026-07-19-sse-postgres-notify-design.md`). Composes an
 * `InProcessEventBus` (the local fan-out engine, reused verbatim) and swaps the
 * transport: publish = fire-and-forget `pg_notify` on the pool; receive = a dedicated
 * standalone `pg.Client` LISTENing on `mr_events` that validates each notification and
 * replays the matching method on the wrapped bus. Delivery contract is unchanged from
 * the in-memory bus: signal-only, best-effort, at-most-once.
 */
export class PostgresEventBus implements EventBus {
  private readonly local = new InProcessEventBus()
  private readonly pool: pg.Pool
  private readonly databaseUrl: string
  private readonly logger: Logger
  private client: pg.Client | null = null
  private stopped = false
  private backoffMs = INITIAL_BACKOFF_MS
  private startResolve: (() => void) | null = null

  constructor(pool: pg.Pool, databaseUrl: string, logger: Logger) {
    this.pool = pool
    this.databaseUrl = databaseUrl
    this.logger = logger
  }

  publishClaimCreated(payload: ClaimEventPayload, customerId?: string | null): void {
    void this.notify({ kind: NotifyKind.ClaimCreated, payload, customerId })
  }

  publishClaimUpdated(payload: ClaimEventPayload, customerId?: string | null): void {
    void this.notify({ kind: NotifyKind.ClaimUpdated, payload, customerId })
  }

  publishClaimDeleted(payload: ClaimEventPayload, customerId?: string | null): void {
    void this.notify({ kind: NotifyKind.ClaimDeleted, payload, customerId })
  }

  publishResourceChanged(resource: ResourceChangedKey): void {
    void this.notify({ kind: NotifyKind.ResourceChanged, resource })
  }

  publishClientSubmissionChanged(submissionId: string): void {
    void this.notify({ kind: NotifyKind.ClientSubmissionChanged, submissionId })
  }

  publishNotificationCreated(userId: string, notificationId: string): void {
    void this.notify({ kind: NotifyKind.NotificationCreated, userId, notificationId })
  }

  subscribeUser(
    userId: string,
    roleCodes: readonly string[],
    listener: (event: AppEvent) => void,
    customerIds?: readonly string[],
  ): () => void {
    return this.local.subscribeUser(userId, roleCodes, listener, customerIds)
  }

  /**
   * Kicks the reconnect loop once and resolves the first time `LISTEN` is established,
   * so tests can `await` it before publishing. Prod fires it fire-and-forget so boot
   * stays synchronous (a not-yet-ready DB is handled by the reconnect loop).
   */
  start(): Promise<void> {
    const started = new Promise<void>((resolve) => {
      this.startResolve = resolve
    })
    void this.connectLoop()
    return started
  }

  /** Stops the reconnect loop and closes the LISTEN client. */
  async dispose(): Promise<void> {
    this.stopped = true
    await this.client?.end()
  }

  private async notify(message: NotifyMessage): Promise<void> {
    // ponytail: NOTIFY caps a payload at 8000 bytes; ours are ids + kind, far under it — no guard.
    const json = JSON.stringify(message)
    try {
      await this.pool.query('SELECT pg_notify($1, $2)', [CHANNEL, json])
    } catch (err) {
      this.logger.warn({ err }, 'pg_notify publish failed')
    }
  }

  /**
   * The single reconnect path (spec §5): connect → LISTEN → park until the connection
   * drops → backoff → retry. The `'error'` listener is attached BEFORE `connect()` (an
   * unhandled `'error'` on a `pg.Client` is a Node EventEmitter throw = process crash);
   * both `'error'` and `'end'` only `resolve()` the SAME `closed` promise, so a real drop
   * (which fires both) advances the loop exactly ONCE → one reconnect, no leaked client.
   *
   * ponytail: signals during the reconnect gap are missed — identical to a briefly
   * disconnected client; upgrade path is an outbox if guaranteed delivery is ever needed.
   */
  private async connectLoop(): Promise<void> {
    while (!this.stopped) {
      const client = new pg.Client({ connectionString: this.databaseUrl })
      const closed = new Promise<void>((resolve) => {
        client.on('error', (err) => {
          this.logger.warn({ err }, 'listen client error')
          resolve()
        })
        client.on('end', () => resolve())
      })
      client.on('notification', (msg) => this.onNotify(msg))
      try {
        await client.connect()
        await client.query(`LISTEN ${CHANNEL}`)
        this.client = client
        this.backoffMs = INITIAL_BACKOFF_MS
        this.startResolve?.()
        this.startResolve = null
        await closed
      } catch (err) {
        this.logger.warn({ err }, 'listen connect failed')
      } finally {
        this.client = null
        await client.end().catch(() => {})
      }
      if (this.stopped) break
      await this.sleep(this.backoffMs)
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
    }
  }

  private onNotify(msg: pg.Notification): void {
    if (msg.payload === undefined) return
    let parsed: unknown
    try {
      parsed = JSON.parse(msg.payload)
    } catch (err) {
      this.logger.warn({ err }, 'failed to parse NOTIFY payload')
      return
    }
    const result = NotifyMessageSchema.safeParse(parsed)
    if (!result.success) {
      // Drop unknown/foreign payloads — also makes rolling-deploy version skew safe.
      this.logger.warn({ issues: result.error.issues }, 'invalid NOTIFY payload')
      return
    }
    try {
      this.replay(result.data)
    } catch (err) {
      this.logger.warn({ err }, 'replay of NOTIFY payload failed')
      return
    }
  }

  private replay(message: NotifyMessage): void {
    switch (message.kind) {
      case NotifyKind.ClaimCreated:
        this.local.publishClaimCreated(message.payload, message.customerId)
        return
      case NotifyKind.ClaimUpdated:
        this.local.publishClaimUpdated(message.payload, message.customerId)
        return
      case NotifyKind.ClaimDeleted:
        this.local.publishClaimDeleted(message.payload, message.customerId)
        return
      case NotifyKind.ResourceChanged:
        this.local.publishResourceChanged(message.resource)
        return
      case NotifyKind.ClientSubmissionChanged:
        this.local.publishClientSubmissionChanged(message.submissionId)
        return
      case NotifyKind.NotificationCreated:
        this.local.publishNotificationCreated(message.userId, message.notificationId)
        return
      default: {
        const _exhaustive: never = message
        return _exhaustive
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms).unref()
    })
  }
}
