import {
  ClaimKind,
  ClaimOutcome,
  ClientClaimPhase,
  type ClientPortalActivityItem,
  type ClientPortalSummary,
} from '@mr/shared'
import { z } from 'zod'

import { ForbiddenError } from '../../core/errors/domain-errors.js'
import {
  SummaryCache,
  SUMMARY_CACHE_TTL_SECONDS,
} from '../../infrastructure/cache/summary-cache.js'
import type { AppSettingsReader } from '../../core/settings/app-settings.reader.js'
import type { ClientClaimAuditRow, DashboardRepository } from './dashboard.repository.js'
import type { DashboardActor, DashboardScope } from './dashboard.types.js'
import type { DashboardSummaryResponse } from './dashboard.validators.js'

// How many audit rows we scan / how many feed items a client gets. The scan
// window is larger because not every audit row yields a feed event.
const CLIENT_ACTIVITY_SCAN_LIMIT = 60
const CLIENT_ACTIVITY_FEED_LIMIT = 8

/**
 * The internal dashboard aggregates GLOBAL data (all customers), so it demands
 * the full view permissions — `view_own_customer` (portal clients) is NOT
 * enough. Clients get their own scoped `/client-summary` projection instead.
 */
function canViewEmotive(actor: DashboardActor): boolean {
  return actor.permissions.includes('emotive_claims.view')
}

function canViewDomace(actor: DashboardActor): boolean {
  return actor.permissions.includes('domace_claims.view')
}

function resolveScope(actor: DashboardActor): DashboardScope {
  const includeEmotive = canViewEmotive(actor)
  const includeDomace = canViewDomace(actor)

  if (!includeEmotive && !includeDomace) {
    throw new ForbiddenError()
  }

  return { includeEmotive, includeDomace }
}

// Loose snapshots of the audit `changes` payload — we only ever read the two
// transition signals; everything else in the jsonb stays untouched/unshipped.
const AuditClaimSnapshotSchema = z.looseObject({
  employeeId: z.string().nullable().optional(),
  outcome: z.string().optional(),
})

const AuditChangesSchema = z.looseObject({
  before: AuditClaimSnapshotSchema.optional(),
  after: AuditClaimSnapshotSchema.optional(),
})

function deriveActivityEvent(row: ClientClaimAuditRow): ClientPortalActivityItem | null {
  const base = {
    kind: ClaimKind.Emotive,
    claimId: row.claimId,
    mrNumber: row.mrNumber,
    claimNumber: row.claimNumber,
    occurredAt: row.occurredAt.toISOString(),
  }

  if (row.action === 'create') {
    return { ...base, event: ClientClaimPhase.Received, outcome: null }
  }

  const parsed = AuditChangesSchema.safeParse(row.changes)
  if (!parsed.success || parsed.data.before === undefined || parsed.data.after === undefined) {
    return null
  }

  const { before, after } = parsed.data

  if (
    before.outcome === ClaimOutcome.Pending &&
    (after.outcome === ClaimOutcome.Accepted || after.outcome === ClaimOutcome.Rejected) &&
    row.publishedAt !== null
  ) {
    // Phase 2 visibility gate: this outcome-change row re-derives on every
    // request, so once the claim is published (publishedAt flips non-null)
    // the SAME row naturally starts producing an Outcome event — no need to
    // special-case the publish audit row itself (its `changes` has no
    // before/after, so it already falls through to null below).
    return { ...base, event: ClientClaimPhase.Outcome, outcome: after.outcome }
  }

  const employeeAssigned =
    (before.employeeId ?? null) === null && (after.employeeId ?? null) !== null
  if (employeeAssigned) {
    return { ...base, event: ClientClaimPhase.InProgress, outcome: null }
  }

  return null
}

export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly summaryCache: SummaryCache,
    private readonly appSettings: AppSettingsReader,
  ) {}

  async getSummary(actor: DashboardActor, chartMonths?: number): Promise<DashboardSummaryResponse> {
    // Global (all-customers) dashboard: keyed only by scope (~2 variants), never per user.
    // getClientSummary below stays UNCACHED — it is per-customer and low-hit.
    const scope = resolveScope(actor)
    // ⚠ The permission is part of the CACHE KEY, not a filter applied to the result.
    // `topFaultEmployees` names people, and a payload keyed on scope alone would let a reader who
    // holds `employees.view_analytics` warm the cache and a reader who does not read the names out
    // of it — in whichever order they happened to arrive. Two scopes become four entries; that is
    // the whole cost.
    const includeNamedBlame = actor.permissions.includes('employees.view_analytics')
    // The window is part of the key for the same reason the permission is: two callers ask for
    // different charts, and one must never be served the other's.
    return this.summaryCache.read(
      'dashboard',
      [scope.includeEmotive, scope.includeDomace, includeNamedBlame, chartMonths ?? null],
      SUMMARY_CACHE_TTL_SECONDS,
      () => this.repo.getSummary(scope, includeNamedBlame, chartMonths),
    )
  }

  /**
   * Portal dashboard projection: phase counts + recent-activity feed, scoped
   * to the actor's linked customers (internal full-view actors see all). Only
   * claim number + event type + timestamp ever leave the server — never audit
   * internals (actor, IP, before/after rows).
   */
  async getClientSummary(actor: DashboardActor): Promise<ClientPortalSummary> {
    const mayRead =
      actor.permissions.includes('emotive_claims.view') ||
      actor.permissions.includes('emotive_claims.view_own_customer')
    if (!mayRead) {
      throw new ForbiddenError()
    }

    // Always the ACTOR'S OWN links, never the unscoped set: an internal full-view
    // actor also reaches this handler, and their firm names must stay empty rather
    // than following the unscoped stats branch. (This endpoint's twin leaked once.)
    const settings = await this.appSettings.resolveAll()
    const support = { phone: settings.supportPhone, email: settings.supportEmail }

    const firms = await this.repo.getUserFirms(actor.id)
    const firmNames = firms.map((firm) => firm.name)
    // ALWAYS the actor's own firms — a full-view actor is not exempt. This projection is the
    // PORTAL's, and the portal is a client-only app: answering an internal reader with the whole
    // shop's numbers is how a screen meant for one firm came to show 114 claims and somebody
    // else's MR numbers (found 2026-08-21, the same shape as the /summary leak before it).
    // An internal reader who wants the whole shop has /api/dashboard/summary.
    const customerIds = firms.map((firm) => firm.id)

    if (customerIds.length === 0) {
      return {
        stats: { received: 0, inProgress: 0, resolved: 0, total: 0 },
        activity: [],
        firmNames,
        support,
      }
    }

    const [stats, auditRows] = await Promise.all([
      this.repo.getClientStats(customerIds),
      this.repo.getClientClaimAuditRows(customerIds, CLIENT_ACTIVITY_SCAN_LIMIT),
    ])

    const activity = auditRows
      .map(deriveActivityEvent)
      .filter((event): event is ClientPortalActivityItem => event !== null)
      .slice(0, CLIENT_ACTIVITY_FEED_LIMIT)

    return { stats, activity, firmNames, support }
  }
}
