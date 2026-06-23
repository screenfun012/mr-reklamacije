import {
  AuditAction,
  ClaimKind,
  ClaimOutcome,
  buildDefaultClaimReportResponse,
  isClaimReportEmpty,
  type ClaimReportQuery,
  type ClaimReportResponse,
  type ClaimReportUpsertBody,
} from '@mr/shared'

import { assertClaimEditable } from '../../core/claims/claim-lock.js'
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { StorageService } from '../../infrastructure/storage/storage.interface.js'
import type { AttachmentsRepository } from '../attachments/attachments.repository.js'
import type { DomaceClaimsRepository } from '../domace-claims/domace-claims.repository.js'
import type { EmotiveClaimsRepository } from '../emotive-claims/emotive-claims.repository.js'
import { renderClaimReportDocx } from './claim-report-export-docx.js'
import { renderClaimReportPdf } from './claim-report-export-pdf.js'
import { ClaimReportImageLoaderImpl } from './claim-report-image-loader.js'
import { hydrateClaimReportImages } from './hydrate-claim-report-images.js'
import { ClaimReportsRepository } from './claim-reports.repository.js'
import { sanitizeClaimReportHtml } from './sanitize-claim-report-html.js'
import type { ClaimReportsActor, ClaimReportsAuditContext } from './claim-reports.types.js'

export interface ClaimReportExportResult {
  buffer: Buffer
  fileName: string
  mimeType: string
}

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

function buildExportFileName(claimId: string, extension: 'pdf' | 'docx'): string {
  return `izvestaj-${claimId}.${extension}`
}

export class ClaimReportsService {
  private readonly imageLoader: ClaimReportImageLoaderImpl

  constructor(
    private readonly repo: ClaimReportsRepository,
    private readonly emotiveClaimsRepository: EmotiveClaimsRepository,
    private readonly domaceClaimsRepository: DomaceClaimsRepository,
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditPort,
    private readonly claimReportPdfEnabled: boolean,
  ) {
    this.imageLoader = new ClaimReportImageLoaderImpl(attachmentsRepository, storage)
  }

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

  async exportDocx(
    query: ClaimReportQuery,
    actor: ClaimReportsActor,
    auditContext: ClaimReportsAuditContext,
  ): Promise<ClaimReportExportResult> {
    const prepared = await this.prepareExportHtml(query, actor)
    const buffer = await renderClaimReportDocx(prepared.html)

    await this.audit.log({
      entityType: 'claim_report',
      entityId: prepared.reportId,
      action: AuditAction.Export,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      context: {
        claimKind: query.claimKind,
        claimId: query.claimId,
        format: 'docx',
      },
    })

    return {
      buffer,
      fileName: buildExportFileName(query.claimId, 'docx'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  async exportPdf(
    query: ClaimReportQuery,
    actor: ClaimReportsActor,
    auditContext: ClaimReportsAuditContext,
  ): Promise<ClaimReportExportResult> {
    if (!this.claimReportPdfEnabled) {
      throw new ServiceUnavailableError(
        'PDF izvoz trenutno nije dostupan. Koristite štampu iz pregleda izveštaja.',
      )
    }

    const prepared = await this.prepareExportHtml(query, actor)
    const buffer = await renderClaimReportPdf(prepared.html)

    await this.audit.log({
      entityType: 'claim_report',
      entityId: prepared.reportId,
      action: AuditAction.Export,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      context: {
        claimKind: query.claimKind,
        claimId: query.claimId,
        format: 'pdf',
      },
    })

    return {
      buffer,
      fileName: buildExportFileName(query.claimId, 'pdf'),
      mimeType: 'application/pdf',
    }
  }

  private async prepareExportHtml(
    query: ClaimReportQuery,
    actor: ClaimReportsActor,
  ): Promise<{ html: string; reportId: string }> {
    if (!actor.permissions.includes('claim_reports.export')) {
      throw new ForbiddenError()
    }

    await this.loadClaimContext(query.claimKind, query.claimId, actor)

    const existing = await this.repo.findByClaim(query)
    if (existing === null || isClaimReportEmpty(existing.contentHtml)) {
      throw new NotFoundError('Claim report', query.claimId)
    }

    const sanitizedHtml = sanitizeClaimReportHtml(existing.contentHtml)
    const hydratedHtml = await hydrateClaimReportImages(
      sanitizedHtml,
      { claimKind: query.claimKind, claimId: query.claimId },
      this.imageLoader,
    )

    return { html: hydratedHtml, reportId: existing.id }
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
