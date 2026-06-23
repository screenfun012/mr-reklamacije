import {
  AuditAction,
  ClaimKind,
  ClaimOutcome,
  buildDefaultClaimReportResponse,
  type ClaimReportQuery,
  type ClaimReportResponse,
  type ClaimReportUpsertBody,
} from '@mr/shared'

import { assertClaimEditable } from '../../core/claims/claim-lock.js'
import { ForbiddenError, NotFoundError } from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { DomaceClaimsRepository } from '../domace-claims/domace-claims.repository.js'
import type { EmotiveClaimsRepository } from '../emotive-claims/emotive-claims.repository.js'
import { ClaimReportsRepository } from './claim-reports.repository.js'
import { sanitizeClaimReportHtml } from './sanitize-claim-report-html.js'
import type { ClaimReportsActor, ClaimReportsAuditContext } from './claim-reports.types.js'

function resolveEmotiveScope(actor: ClaimReportsActor) {
  if (actor.permissions.includes('emotive_claims.view')) {
    return { type: 'all' as const }
  }
  if (actor.permissions.includes('emotive_claims.view_own_customer')) {
    return { type: 'own_customer' as const, userId: actor.id }
  }
  throw new ForbiddenError()
}

function resolveDomaceScope(actor: ClaimReportsActor) {
  if (actor.permissions.includes('domace_claims.view')) {
    return { type: 'all' as const }
  }
  if (actor.permissions.includes('domace_claims.view_own_customer')) {
    return { type: 'own_customer' as const, userId: actor.id }
  }
  throw new ForbiddenError()
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

function mapToResponse(row: {
  id: string
  claimKind: ClaimReportResponse['claimKind']
  claimId: string
  contentJson: ClaimReportResponse['contentJson']
  contentHtml: string
  status: ClaimReportResponse['status']
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
}): ClaimReportResponse {
  return {
    id: row.id,
    claimKind: row.claimKind,
    claimId: row.claimId,
    contentJson: row.contentJson,
    contentHtml: row.contentHtml,
    status: row.status,
    persisted: true,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  }
}

export class ClaimReportsService {
  constructor(
    private readonly repo: ClaimReportsRepository,
    private readonly emotiveClaimsRepository: EmotiveClaimsRepository,
    private readonly domaceClaimsRepository: DomaceClaimsRepository,
    private readonly audit: AuditPort,
  ) {}

  async get(query: ClaimReportQuery, actor: ClaimReportsActor): Promise<ClaimReportResponse> {
    if (!actor.permissions.includes('claim_reports.view')) {
      throw new ForbiddenError()
    }

    await this.loadClaimContext(query.claimKind, query.claimId, actor)

    const existing = await this.repo.findByClaim(query)
    if (existing === null) {
      return buildDefaultClaimReportResponse(query.claimKind, query.claimId)
    }

    return mapToResponse(existing)
  }

  async upsert(
    query: ClaimReportQuery,
    body: ClaimReportUpsertBody,
    actor: ClaimReportsActor,
    auditContext: ClaimReportsAuditContext,
  ): Promise<ClaimReportResponse> {
    if (!actor.permissions.includes('claim_reports.update')) {
      throw new ForbiddenError()
    }

    const claim = await this.loadClaimContext(query.claimKind, query.claimId, actor)
    assertClaimEditable(claim)

    const sanitizedHtml = sanitizeClaimReportHtml(body.contentHtml)

    const existing = await this.repo.findByClaim(query)
    const saved = await this.repo.upsert({
      claimKind: query.claimKind,
      claimId: query.claimId,
      contentJson: body.contentJson,
      contentHtml: sanitizedHtml,
      updatedBy: actor.id,
    })

    await this.audit.log({
      entityType: 'claim_report',
      entityId: saved.id,
      action: existing === null ? AuditAction.Create : AuditAction.Update,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      context: {
        claimKind: query.claimKind,
        claimId: query.claimId,
      },
    })

    return mapToResponse(saved)
  }

  private async loadClaimContext(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
    actor: ClaimReportsActor,
  ): Promise<{ outcome: ClaimOutcome }> {
    if (claimKind === ClaimKind.Emotive) {
      const scope = resolveEmotiveScope(actor)
      const claim = await this.emotiveClaimsRepository.findById(claimId, scope)
      if (claim === null) {
        throw new NotFoundError('Emotive claim', claimId)
      }

      return { outcome: claim.outcome }
    }

    const scope = resolveDomaceScope(actor)
    const claim = await this.domaceClaimsRepository.findById(claimId, scope)
    if (claim === null) {
      throw new NotFoundError('Domace claim', claimId)
    }

    return { outcome: claim.outcome }
  }
}
