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

/**
 * A portal-submission attachment projection — the claim-scoped `AttachmentListItem` cannot
 * represent it (a submission attachment has `claim_kind` NULL and no claim id).
 */
export interface SubmissionAttachmentItem {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSizeBytes: number
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
  readonly thumbnailPath: string | null
  readonly caption: string | null
  readonly uploadedBy: string | null
  readonly uploadedAt: string
  readonly contentSha256: string
}

export interface SubmissionAttachmentUploadResult {
  readonly items: SubmissionAttachmentItem[]
  readonly skippedDuplicates: number
}
