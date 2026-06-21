import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type ApiDatabase = NodePgDatabase<typeof schema>

/** Drizzle transaction client — subset used for MR registry writes inside claim TX. */
export type ApiDbExecutor = Pick<ApiDatabase, 'insert' | 'delete' | 'select'>
