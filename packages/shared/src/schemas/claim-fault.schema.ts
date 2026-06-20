import { z } from 'zod'

import { FaultType } from '../enums.js'

const faultTypeValues = [FaultType.Employee, FaultType.Department, FaultType.External] as const

/**
 * Fault attribution input, shared by every claim module (EMOTIVE, DOMACE).
 * A fault points at exactly one of employee / department / external party.
 */
export const ClaimFaultInputSchema = z.discriminatedUnion('faultType', [
  z.object({
    faultType: z.literal(FaultType.Employee),
    employeeId: z.string().uuid(),
    notes: z.string().trim().max(4000).optional(),
  }),
  z.object({
    faultType: z.literal(FaultType.Department),
    departmentId: z.string().uuid(),
    notes: z.string().trim().max(4000).optional(),
  }),
  z.object({
    faultType: z.literal(FaultType.External),
    externalPartyId: z.string().uuid(),
    notes: z.string().trim().max(4000).optional(),
  }),
])

export type ClaimFaultInput = z.infer<typeof ClaimFaultInputSchema>

/** Resolved fault row returned by the API (reference names joined server-side). */
export const ClaimFaultItemSchema = z.object({
  id: z.string().uuid(),
  faultType: z.enum(faultTypeValues),
  employeeId: z.string().uuid().nullable(),
  employeeName: z.string().nullable(),
  departmentId: z.string().uuid().nullable(),
  departmentName: z.string().nullable(),
  externalPartyId: z.string().uuid().nullable(),
  externalPartyName: z.string().nullable(),
  notes: z.string().nullable(),
})

export type ClaimFaultItem = z.infer<typeof ClaimFaultItemSchema>
