import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type ApiDatabase = NodePgDatabase<typeof schema>
