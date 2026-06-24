import { schema } from '@mr/db'
import type { ClaimFaultItem, ExcelExportInput } from '@mr/shared'
import { and, asc, eq, gte, inArray, isNull, lte, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { domaceClaims } from '../domace-claims/domace-claims.schema.js'
import {
  claimSources,
  customerUsers,
  emotiveClaimFaults,
  emotiveClaims,
} from '../emotive-claims/emotive-claims.schema.js'
import type { DomaceExportDbRow, EmotiveExportDbRow, ExcelActor } from './excel.types.js'

const { departments, employees, engineTypes, externalParties } = schema

function formatDate(value: Date | string | null): string | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  return value.toISOString().slice(0, 10)
}

function mapFaultRow(row: {
  id: string
  faultType: string
  employeeId: string | null
  employeeName: string | null
  departmentId: string | null
  departmentName: string | null
  externalPartyId: string | null
  externalPartyName: string | null
  notes: string | null
}): ClaimFaultItem {
  return {
    id: row.id,
    faultType: row.faultType as ClaimFaultItem['faultType'],
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    externalPartyId: row.externalPartyId,
    externalPartyName: row.externalPartyName,
    notes: row.notes,
  }
}

function buildEmotiveConditions(input: ExcelExportInput): SQL[] {
  const conditions: SQL[] = [isNull(emotiveClaims.deletedAt)]

  if (input.claimYear !== undefined) {
    conditions.push(eq(emotiveClaims.claimYear, input.claimYear))
  }

  if (input.outcome !== undefined) {
    conditions.push(eq(emotiveClaims.outcome, input.outcome))
  }

  if (input.dateFrom !== undefined) {
    conditions.push(gte(emotiveClaims.dateOfClaim, input.dateFrom))
  }

  if (input.dateTo !== undefined) {
    conditions.push(lte(emotiveClaims.dateOfClaim, input.dateTo))
  }

  return conditions
}

function buildDomaceConditions(input: ExcelExportInput): SQL[] {
  const conditions: SQL[] = [isNull(domaceClaims.deletedAt)]

  if (input.claimYear !== undefined) {
    conditions.push(eq(domaceClaims.claimYear, input.claimYear))
  }

  if (input.outcome !== undefined) {
    conditions.push(eq(domaceClaims.outcome, input.outcome))
  }

  if (input.dateFrom !== undefined) {
    conditions.push(gte(domaceClaims.dateOfClaim, input.dateFrom))
  }

  if (input.dateTo !== undefined) {
    conditions.push(lte(domaceClaims.dateOfClaim, input.dateTo))
  }

  return conditions
}

export class ExcelRepository {
  constructor(private readonly db: ApiDatabase) {}

  private async getUserCustomerIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ customerId: customerUsers.customerId })
      .from(customerUsers)
      .where(eq(customerUsers.userId, userId))

    return rows.map((row) => row.customerId)
  }

  async listEmotiveForExport(
    input: ExcelExportInput,
    actor: ExcelActor,
  ): Promise<EmotiveExportDbRow[]> {
    const conditions = buildEmotiveConditions(input)

    if (
      !actor.permissions.includes('emotive_claims.view') &&
      actor.permissions.includes('emotive_claims.view_own_customer')
    ) {
      const customerIds = await this.getUserCustomerIds(actor.id)
      if (customerIds.length === 0) {
        return []
      }
      conditions.push(inArray(emotiveClaims.customerId, customerIds))
    } else if (!actor.permissions.includes('emotive_claims.view')) {
      return []
    }

    const whereClause = and(...conditions)

    const rows = await this.db
      .select({
        id: emotiveClaims.id,
        sequenceNumber: emotiveClaims.sequenceNumber,
        warrantyReport: emotiveClaims.warrantyReport,
        engineTypeCode: engineTypes.code,
        dateOfClaim: emotiveClaims.dateOfClaim,
        mrNumber: emotiveClaims.mrNumber,
        dateOfFinish: emotiveClaims.dateOfFinish,
        claimNumber: emotiveClaims.claimNumber,
        employeeName: employees.fullName,
        sourceName: claimSources.name,
        claimYear: emotiveClaims.claimYear,
      })
      .from(emotiveClaims)
      .innerJoin(engineTypes, eq(emotiveClaims.engineTypeId, engineTypes.id))
      .leftJoin(employees, eq(emotiveClaims.employeeId, employees.id))
      .leftJoin(claimSources, eq(emotiveClaims.sourceId, claimSources.id))
      .where(whereClause)
      .orderBy(asc(emotiveClaims.sequenceNumber))

    if (rows.length === 0) {
      return []
    }

    const claimIds = rows.map((row) => row.id)
    const faultRows = await this.db
      .select({
        id: emotiveClaimFaults.id,
        claimId: emotiveClaimFaults.claimId,
        faultType: emotiveClaimFaults.faultType,
        employeeId: emotiveClaimFaults.employeeId,
        employeeName: employees.fullName,
        departmentId: emotiveClaimFaults.departmentId,
        departmentName: departments.nameSr,
        externalPartyId: emotiveClaimFaults.externalPartyId,
        externalPartyName: externalParties.name,
        notes: emotiveClaimFaults.notes,
      })
      .from(emotiveClaimFaults)
      .leftJoin(employees, eq(emotiveClaimFaults.employeeId, employees.id))
      .leftJoin(departments, eq(emotiveClaimFaults.departmentId, departments.id))
      .leftJoin(externalParties, eq(emotiveClaimFaults.externalPartyId, externalParties.id))
      .where(inArray(emotiveClaimFaults.claimId, claimIds))

    const faultsByClaimId = new Map<string, ClaimFaultItem[]>()
    for (const fault of faultRows) {
      const mapped = mapFaultRow(fault)
      const existing = faultsByClaimId.get(fault.claimId) ?? []
      existing.push(mapped)
      faultsByClaimId.set(fault.claimId, existing)
    }

    return rows.map((row) => ({
      id: row.id,
      sequenceNumber: row.sequenceNumber,
      warrantyReport: row.warrantyReport,
      engineTypeCode: row.engineTypeCode,
      dateOfClaim: formatDate(row.dateOfClaim),
      mrNumber: row.mrNumber,
      dateOfFinish: formatDate(row.dateOfFinish),
      claimNumber: row.claimNumber,
      employeeName: row.employeeName,
      sourceName: row.sourceName,
      claimYear: row.claimYear,
      faults: faultsByClaimId.get(row.id) ?? [],
    }))
  }

  async listDomaceForExport(
    input: ExcelExportInput,
    actor: ExcelActor,
  ): Promise<DomaceExportDbRow[]> {
    const conditions = buildDomaceConditions(input)

    if (
      !actor.permissions.includes('domace_claims.view') &&
      actor.permissions.includes('domace_claims.view_own_customer')
    ) {
      // DOMACE uses free-text customer_name; no customer_users join yet — return empty for scoped users.
      return []
    }

    if (!actor.permissions.includes('domace_claims.view')) {
      return []
    }

    const whereClause = and(...conditions)

    const rows = await this.db
      .select({
        sequenceNumber: domaceClaims.sequenceNumber,
        dateOfClaim: domaceClaims.dateOfClaim,
        customerName: domaceClaims.customerName,
        outcome: domaceClaims.outcome,
        totalAmount: domaceClaims.totalAmount,
        employeeName: employees.fullName,
        internalNotes: domaceClaims.internalNotes,
      })
      .from(domaceClaims)
      .leftJoin(employees, eq(domaceClaims.employeeId, employees.id))
      .where(whereClause)
      .orderBy(asc(domaceClaims.sequenceNumber))

    return rows.map((row) => ({
      sequenceNumber: row.sequenceNumber,
      dateOfClaim: formatDate(row.dateOfClaim),
      customerName: row.customerName,
      outcome: row.outcome as DomaceExportDbRow['outcome'],
      totalAmount: row.totalAmount,
      employeeName: row.employeeName,
      internalNotes: row.internalNotes,
    }))
  }
}
