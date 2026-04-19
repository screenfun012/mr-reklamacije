import type { UserLanguage } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  inet,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { citext } from './pg-types.js'

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(),
  module: text('module').notNull(),
  action: text('action').notNull(),
  nameSr: text('name_sr').notNull(),
  nameEn: text('name_en').notNull(),
  descriptionSr: text('description_sr').notNull(),
  descriptionEn: text('description_en').notNull(),
})

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: citext('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text('name').notNull(),
    image: text('image'),
    isActive: boolean('is_active').notNull().default(true),
    preferredLanguage: text('preferred_language')
      .notNull()
      .default('sr')
      .$type<UserLanguage>(),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    lastLoginIp: inet('last_login_ip'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('users_email_key').on(t.email),
    check(
      'users_preferred_language_check',
      sql`${t.preferredLanguage} IN ('sr', 'en')`,
    ),
  ],
)

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    nameSr: text('name_sr').notNull(),
    nameEn: text('name_en').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('roles_code_key').on(t.code),
    foreignKey({
      name: 'roles_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'roles_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
)

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull(),
    permissionId: text('permission_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    foreignKey({
      name: 'role_permissions_role_id_fkey',
      columns: [t.roleId],
      foreignColumns: [roles.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'role_permissions_permission_id_fkey',
      columns: [t.permissionId],
      foreignColumns: [permissions.id],
    }).onDelete('restrict'),
    index('idx_role_permissions_permission_id').on(t.permissionId),
  ],
)

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    assignedBy: uuid('assigned_by').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    foreignKey({
      name: 'user_roles_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'user_roles_role_id_fkey',
      columns: [t.roleId],
      foreignColumns: [roles.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'user_roles_assigned_by_fkey',
      columns: [t.assignedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    index('idx_user_roles_role_id').on(t.roleId),
  ],
)

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}))

export const rolesRelations = relations(roles, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [roles.createdBy],
    references: [users.id],
    relationName: 'roles_created_by',
  }),
  updatedByUser: one(users, {
    fields: [roles.updatedBy],
    references: [users.id],
    relationName: 'roles_updated_by',
  }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    relationName: 'user_roles_user',
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  assigner: one(users, {
    relationName: 'user_roles_assigned_by',
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}))
