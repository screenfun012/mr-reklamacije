import { schema } from '@mr/db'

export const attachments = schema.attachments
export const claimObservations = schema.claimObservations
// Read-only lookup for routing portal SSE signals to the owning customer.
export const emotiveClaims = schema.emotiveClaims
