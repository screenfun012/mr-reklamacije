import { PERMISSIONS } from '@mr/shared'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

export async function seedPermissions(db: NodePgDatabase<typeof schema>): Promise<void> {
  const values = PERMISSIONS.map((code) => {
    const [module, ...actionParts] = code.split('.')
    const action = actionParts.join('.')
    return {
      id: code,
      module: module!,
      action,
      nameSr: code,
      nameEn: code,
      descriptionSr: '',
      descriptionEn: '',
    }
  })

  const inserted = await db
    .insert(schema.permissions)
    .values(values)
    .onConflictDoNothing({ target: schema.permissions.id })
    .returning({ id: schema.permissions.id })

  console.log(`[seed:permissions] Inserted ${inserted.length} / ${values.length} permissions`)
}
