import { z } from 'zod'

import { ClaimOutcome } from '../enums.js'

export const ExcelExportScope = {
  All: 'all',
  Emotive: 'emotive',
  Domace: 'domace',
} as const

export type ExcelExportScope = (typeof ExcelExportScope)[keyof typeof ExcelExportScope]

const excelExportScopeValues = [
  ExcelExportScope.All,
  ExcelExportScope.Emotive,
  ExcelExportScope.Domace,
] as const

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

export const ExcelExportInputSchema = z.object({
  scope: z.enum(excelExportScopeValues).default(ExcelExportScope.All),
  claimYear: z.coerce.number().int().min(2000).max(2100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  outcome: z.enum(claimOutcomeValues).optional(),
})

export type ExcelExportInput = z.infer<typeof ExcelExportInputSchema>

export function isFullExcelExport(input: ExcelExportInput): boolean {
  return (
    input.scope === ExcelExportScope.All &&
    input.claimYear === undefined &&
    input.dateFrom === undefined &&
    input.dateTo === undefined &&
    input.outcome === undefined
  )
}
