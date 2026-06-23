import type { ClaimOutcome } from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'

export interface AttachmentsActor {
  readonly id: string
  readonly permissions: readonly string[]
}

export type AttachmentsViewScope =
  | { readonly type: 'internal' }
  | { readonly type: 'client_visible_only' }

export type AttachmentsAuditContext = HttpActorContext

export interface ClaimAttachmentContext {
  readonly outcome: ClaimOutcome
  readonly claimYear: number
}
