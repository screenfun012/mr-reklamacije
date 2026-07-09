import {
  EmotiveClaimFaultInputSchema,
  FaultType,
  type EmotiveClaimFaultInput,
  type EmotiveClaimFaultItem,
} from '@mr/shared'
import { z } from 'zod'

/**
 * UI-side draft for a single fault row. Looser than the wire schema: every id is
 * optional and may be an empty string while the operator is still picking the
 * culprit. {@link faultDraftsToInput} / {@link validateFaultDrafts} turn drafts
 * into the validated {@link EmotiveClaimFaultInput} shape the API expects.
 */
export type EmotiveClaimFaultDraft = {
  faultType: (typeof FaultType)[keyof typeof FaultType]
  employeeId?: string
  departmentId?: string
  externalPartyId?: string
  notes?: string
}

function faultDraftToPayload(fault: EmotiveClaimFaultDraft): unknown {
  const notes = fault.notes?.trim() ? fault.notes.trim() : undefined
  if (fault.faultType === FaultType.Employee) {
    return { faultType: fault.faultType, employeeId: fault.employeeId, notes }
  }
  if (fault.faultType === FaultType.Department) {
    return { faultType: fault.faultType, departmentId: fault.departmentId, notes }
  }
  return { faultType: fault.faultType, externalPartyId: fault.externalPartyId, notes }
}

export function faultDraftsToInput(faults: EmotiveClaimFaultDraft[]): EmotiveClaimFaultInput[] {
  return faults.map((fault) => {
    const result = EmotiveClaimFaultInputSchema.safeParse(faultDraftToPayload(fault))
    if (!result.success) {
      throw result.error
    }
    return result.data
  })
}

export function validateFaultDrafts(faults: EmotiveClaimFaultDraft[]): z.ZodError | null {
  const issues: z.ZodIssue[] = []

  faults.forEach((fault, index) => {
    const result = EmotiveClaimFaultInputSchema.safeParse(faultDraftToPayload(fault))
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          ...issue,
          path: ['faults', index, ...issue.path],
        })
      }
    }
  })

  if (issues.length === 0) {
    return null
  }

  return new z.ZodError(issues)
}

/** Server fault row → editable draft (seed for the detail edit mode). */
export function faultItemToDraft(item: EmotiveClaimFaultItem): EmotiveClaimFaultDraft {
  const notes = item.notes === null ? {} : { notes: item.notes }
  switch (item.faultType) {
    case FaultType.Employee:
      return { faultType: FaultType.Employee, employeeId: item.employeeId ?? '', ...notes }
    case FaultType.Department:
      return { faultType: FaultType.Department, departmentId: item.departmentId ?? '', ...notes }
    case FaultType.External:
      return {
        faultType: FaultType.External,
        externalPartyId: item.externalPartyId ?? '',
        ...notes,
      }
    default: {
      const exhaustive: never = item.faultType
      return exhaustive
    }
  }
}
