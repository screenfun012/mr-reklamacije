import {
  ADMIN_PERMISSIONS,
  CLIENT_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_SERVISER,
  SYSTEM_ROLE_VIEWER,
  VIEWER_PERMISSIONS,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

interface RoleSeed {
  code: string
  nameSr: string
  nameEn: string
  permissions: readonly string[]
}

const SYSTEM_ROLES: RoleSeed[] = [
  {
    code: SYSTEM_ROLE_ADMIN,
    nameSr: 'Administrator',
    nameEn: 'Administrator',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_OPERATOR,
    nameSr: 'Operater',
    nameEn: 'Operator',
    permissions: OPERATOR_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_VIEWER,
    nameSr: 'Pregled',
    nameEn: 'Viewer',
    permissions: VIEWER_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_SERVISER,
    nameSr: 'Serviser',
    nameEn: 'Service technician',
    permissions: SERVISER_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_CLIENT,
    nameSr: 'Klijent',
    nameEn: 'Client',
    permissions: CLIENT_PERMISSIONS,
  },
]

export async function seedRoles(db: NodePgDatabase<typeof schema>): Promise<void> {
  let rolesInserted = 0
  let junctionsInserted = 0

  for (const roleSeed of SYSTEM_ROLES) {
    const insertedRows = await db
      .insert(schema.roles)
      .values({
        code: roleSeed.code,
        nameSr: roleSeed.nameSr,
        nameEn: roleSeed.nameEn,
        isSystem: true,
      })
      .onConflictDoNothing({ target: schema.roles.code })
      .returning({ id: schema.roles.id })

    if (insertedRows.length > 0) {
      rolesInserted++
    }

    const [role] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, roleSeed.code))
      .limit(1)

    if (!role) {
      throw new Error(`[seed:roles] Role ${roleSeed.code} not found after insert`)
    }

    const permissionValues = roleSeed.permissions.map((permissionId) => ({
      roleId: role.id,
      permissionId,
    }))

    if (permissionValues.length > 0) {
      const insertedJunctions = await db
        .insert(schema.rolePermissions)
        .values(permissionValues)
        .onConflictDoNothing({
          target: [schema.rolePermissions.roleId, schema.rolePermissions.permissionId],
        })
        .returning({ permissionId: schema.rolePermissions.permissionId })

      junctionsInserted += insertedJunctions.length
    }
  }

  console.log(
    `[seed:roles] Inserted ${rolesInserted} / ${SYSTEM_ROLES.length} roles, ${junctionsInserted} role_permissions`,
  )
}
