import type { ClientSubmissionStatus } from '@mr/shared'

/** The submission facts the attachments service needs to authorize submission-attachment ops. */
export interface SubmissionAccessInfo {
  readonly submittedByUserId: string
  readonly status: ClientSubmissionStatus
}

/**
 * Read port the attachments service uses to authorize submission-attachment upload/list/serve
 * (ownership + pending status). A core port so the attachments module does not import the
 * client-submissions module directly (depcruise `no-sibling-modules`); the container injects the
 * concrete `ClientSubmissionsRepository`.
 */
export interface SubmissionAccessPort {
  findSubmissionAccess(submissionId: string): Promise<SubmissionAccessInfo | null>
}
