import type { ClaimKind, ClaimOutcome, NotificationCatalog } from '@mr/shared'

/** The claim facts a notification needs to render its title — never claim internals. */
export interface ClaimNotificationContext {
  readonly kind: ClaimKind
  readonly id: string
  readonly mrNumber: string | null
  readonly customerName: string | null
  readonly employeeId: string | null
  readonly outcome: ClaimOutcome
}

/**
 * The slice of the notifications service other domain modules call for fan-out. A core
 * port so those modules depend on core, not a sibling module (depcruise
 * `no-sibling-modules`); the container injects the concrete `NotificationsService`.
 *
 * Every method is best-effort and NEVER rejects — a notification is not worth failing
 * the business operation it describes. The acting user is always excluded.
 */
export interface NotificationsPort {
  notifyNewSubmission(
    actorUserId: string,
    submissionId: string,
    customerName: string,
  ): Promise<void>

  /** `claim_created` to everyone who may view the kind, `assigned_to_me` to the assignee instead. */
  notifyClaimCreated(actorUserId: string, claim: ClaimNotificationContext): Promise<void>

  /** The assignee only — call when an update points `employeeId` at someone new. */
  notifyClaimAssigned(actorUserId: string, claim: ClaimNotificationContext): Promise<void>

  notifyOutcomeChanged(actorUserId: string, claim: ClaimNotificationContext): Promise<void>

  notifyCatalogAdded(
    actorUserId: string,
    catalog: NotificationCatalog,
    itemId: string,
    itemName: string,
  ): Promise<void>
}
