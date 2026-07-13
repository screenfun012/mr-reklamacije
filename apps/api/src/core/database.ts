import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type ApiDatabase = NodePgDatabase<typeof schema>

/** Drizzle transaction client — subset used for MR registry writes inside claim TX. */
export type ApiDbExecutor = Pick<ApiDatabase, 'insert' | 'delete' | 'select'>

/**
 * Drizzle transaction client for claim writes inside a caller-provided TX (adds
 * `update`, needed by the emotive-claim insert path and cross-module conversions).
 */
export type ApiClaimTxExecutor = Pick<ApiDatabase, 'insert' | 'update' | 'delete' | 'select'>
