import type { ClaimKind } from '../enums.js'

export const ClaimEventType = {
  Created: 'claim_created',
  Updated: 'claim_updated',
  Deleted: 'claim_deleted',
} as const

export type ClaimEventType = (typeof ClaimEventType)[keyof typeof ClaimEventType]

export interface ClaimEventPayload {
  kind: ClaimKind
  id: string
}
