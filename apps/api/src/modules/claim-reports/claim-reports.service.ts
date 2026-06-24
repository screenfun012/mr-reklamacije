import {
  AuditAction,
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
import type { ClaimContextPort } from '../../core/ports/claim-context-port.js'
import type { ReportImageReadPort } from '../../core/ports/report-image-read-port.js'
import { renderClaimReportDocx } from './claim-report-export-docx.js'
import { renderClaimReportPdf } from './claim-report-export-pdf.js'
import { hydrateClaimReportImages } from './hydrate-claim-report-images.js'
import { ClaimReportsRepository } from './claim-reports.repository.js'
import { sanitizeClaimReportHtml } from './sanitize-claim-report-html.js'
import type { ClaimReportsActor, ClaimReportsAuditContext } from './claim-reports.types.js'

export interface ClaimReportExportResult {
  buffer: Buffer
  fileName: string
  mimeType: string
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
  constructor(
    private readonly repo: ClaimReportsRepository,
    private readonly claimContext: ClaimContextPort,
    private readonly reportImageRead: ReportImageReadPort,
    private readonly audit: AuditPort,
    private readonly claimReportPdfEnabled: boolean,
  ) {}

  async get(query: ClaimReportQuery, actor: ClaimReportsActor): Promise<ClaimReportResponse> {
    if (!actor.permissions.includes('claim_reports.view')) {
      throw new ForbiddenError()
    }

    await this.claimContext.loadClaimContext(query.claimKind, query.claimId, actor)

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

    const claim = await this.claimContext.loadClaimContext(query.claimKind, query.claimId, actor)
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

    await this.claimContext.loadClaimContext(query.claimKind, query.claimId, actor)

    const existing = await this.repo.findByClaim(query)
    if (existing === null || isClaimReportEmpty(existing.contentHtml)) {
      throw new NotFoundError('Claim report', query.claimId)
    }

    const sanitizedHtml = sanitizeClaimReportHtml(existing.contentHtml)
    const hydratedHtml = await hydrateClaimReportImages(
      sanitizedHtml,
      { claimKind: query.claimKind, claimId: query.claimId },
      this.reportImageRead,
    )

    return { html: hydratedHtml, reportId: existing.id }
  }
}
