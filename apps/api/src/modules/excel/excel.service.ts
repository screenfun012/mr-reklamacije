import { buildReklamacijeWorkbook, type DomaceExportRow, type EmotiveExportRow } from '@mr/excel'
import {
  AuditAction,
  ExcelExportScope,
  type ExcelExportInput,
  isFullExcelExport,
  toAsciiDisplay,
} from '@mr/shared'
import type { ClaimFaultItem } from '@mr/shared'

import { ForbiddenError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { ExcelRepository } from './excel.repository.js'
import type { ExcelActor } from './excel.types.js'

export interface ExcelExportResult {
  buffer: Buffer
  fileName: string
}

function hasAnyPermission(actor: ExcelActor, permissions: readonly string[]): boolean {
  return permissions.some((permission) => actor.permissions.includes(permission))
}

function assertExportAllowed(actor: ExcelActor, input: ExcelExportInput): void {
  const hasPartial = actor.permissions.includes('export.workbook_partial')
  const hasFull = actor.permissions.includes('export.workbook_full')

  if (!hasPartial && !hasFull) {
    throw new ForbiddenError()
  }

  if (isFullExcelExport(input) && !hasFull) {
    throw new ForbiddenError()
  }

  if (
    input.scope !== ExcelExportScope.Domace &&
    !hasAnyPermission(actor, ['emotive_claims.view', 'emotive_claims.view_own_customer'])
  ) {
    throw new ForbiddenError()
  }

  if (
    input.scope !== ExcelExportScope.Emotive &&
    !hasAnyPermission(actor, ['domace_claims.view', 'domace_claims.view_own_customer'])
  ) {
    throw new ForbiddenError()
  }
}

function formatEmployeeNameForExport(name: string | null): string | null {
  if (name === null) {
    return null
  }

  return toAsciiDisplay(name).toUpperCase()
}

function mapFaults(faults: readonly ClaimFaultItem[]): EmotiveExportRow['faults'] {
  return faults.map((fault) => ({
    faultType: fault.faultType,
    employeeName:
      fault.employeeName === null ? null : formatEmployeeNameForExport(fault.employeeName),
    departmentName: fault.departmentName,
    externalPartyName: fault.externalPartyName,
  }))
}

function buildFileName(input: ExcelExportInput, exportedAt: Date): string {
  const datePart = exportedAt.toISOString().slice(0, 10)
  const suffixParts: string[] = [input.scope]

  if (input.claimYear !== undefined) {
    suffixParts.push(String(input.claimYear))
  }

  return `reklamacije-${datePart}-${suffixParts.join('-')}.xlsx`
}

export class ExcelService {
  constructor(
    private readonly repo: ExcelRepository,
    private readonly audit: AuditPort,
  ) {}

  async exportWorkbook(
    input: ExcelExportInput,
    actor: ExcelActor,
    auditContext: HttpActorContext,
  ): Promise<ExcelExportResult> {
    assertExportAllowed(actor, input)

    const exportedAt = new Date()
    const includeEmotive = input.scope !== ExcelExportScope.Domace
    const includeDomace = input.scope !== ExcelExportScope.Emotive

    const emotiveDbRows = includeEmotive ? await this.repo.listEmotiveForExport(input, actor) : []

    const emotiveRows = emotiveDbRows.map(
      (row): EmotiveExportRow => ({
        sequenceNumber: row.sequenceNumber,
        warrantyReport: row.warrantyReport,
        engineTypeCode: row.engineTypeCode,
        dateOfClaim: row.dateOfClaim,
        mrNumber: row.mrNumber,
        dateOfFinish: row.dateOfFinish,
        claimNumber: row.claimNumber,
        employeeId: row.employeeId,
        employeeName: formatEmployeeNameForExport(row.employeeName),
        customerName: row.customerName,
        outcome: row.outcome,
        faults: mapFaults(row.faults),
        claimYear: row.claimYear,
      }),
    )

    const claimYears = [...new Set(emotiveRows.map((row) => row.claimYear))]
    const employeeAssembledByYear =
      includeEmotive && claimYears.length > 0
        ? (await this.repo.listEmployeeAssembledForExport(claimYears)).map((row) => ({
            employeeId: row.employeeId,
            employeeName: formatEmployeeNameForExport(row.employeeName) ?? row.employeeName,
            year: row.year,
            enginesAssembled: row.enginesAssembled,
          }))
        : []

    const domaceRows = includeDomace
      ? (await this.repo.listDomaceForExport(input, actor)).map(
          (row): DomaceExportRow => ({
            sequenceNumber: row.sequenceNumber,
            dateOfClaim: row.dateOfClaim,
            customerName: row.customerName,
            mrNumber: row.mrNumber,
            workOrder: row.mrNumber,
            invoiceNumber: row.claimNumber,
            problemDescription: row.warrantyReport,
            dateOfFinish: row.dateOfFinish,
            engineTypeCode: row.engineTypeCode,
            employeeId: row.employeeId,
            employeeName: formatEmployeeNameForExport(row.employeeName),
            outcome: row.outcome,
            totalAmount: row.totalAmount,
            claimYear: row.claimYear,
            faults: mapFaults(row.faults),
          }),
        )
      : []

    const buffer = await buildReklamacijeWorkbook({
      emotiveRows,
      domaceRows,
      employeeAssembledByYear,
      includeEmotive,
      includeDomace,
      exportedAt,
    })

    await this.audit.log({
      entityType: 'excel_workbook',
      entityId: auditContext.actorUserId,
      action: AuditAction.Export,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      context: {
        scope: input.scope,
        claimYear: input.claimYear ?? null,
        dateFrom: input.dateFrom?.toISOString() ?? null,
        dateTo: input.dateTo?.toISOString() ?? null,
        outcome: input.outcome ?? null,
        emotiveCount: emotiveRows.length,
        domaceCount: domaceRows.length,
      },
    })

    return {
      buffer,
      fileName: buildFileName(input, exportedAt),
    }
  }
}
