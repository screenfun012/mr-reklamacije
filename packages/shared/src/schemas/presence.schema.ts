import { z } from 'zod'

import { ClaimKind } from '../enums.js'

const claimKindValues = [ClaimKind.Emotive, ClaimKind.Domace] as const

/** Which claim a presence heartbeat/leave refers to. */
export const PresenceTargetSchema = z.object({
  kind: z.enum(claimKindValues),
  id: z.string().uuid(),
})

export type PresenceTarget = z.infer<typeof PresenceTargetSchema>

export const PresenceViewerSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
})

export type PresenceViewer = z.infer<typeof PresenceViewerSchema>

/** A heartbeat's answer: everyone ELSE currently on the claim (the caller is excluded). */
export const PresenceHeartbeatResponseSchema = z.object({
  viewers: z.array(PresenceViewerSchema),
})

export type PresenceHeartbeatResponse = z.infer<typeof PresenceHeartbeatResponseSchema>
