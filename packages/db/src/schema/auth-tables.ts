import { relations } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  inet,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { roles, userRoles, users } from './access-control.js'

/**
 * Better-Auth managed tables. Schema hand-written to match project conventions
 * (withTimezone: true, inet for IPs, uuid ids) rather than using CLI-generated
 * output directly. See packages/auth/.generated/better-auth.ts for Better-Auth
 * CLI reference output.
 *
 * All tables CASCADE on user deletion. Better-Auth expects these exact table
 * names via modelName mapping in better-auth.config.ts.
 *
 * `usersRelations` lives here (not in access-control.ts) to avoid a circular
 * import: this file imports `users` from access-control; access-control must
 * not import this file.
 */

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id').notNull(),
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.token),
    index('idx_sessions_user_id').on(t.userId),
    foreignKey({
      name: 'sessions_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_accounts_user_id').on(t.userId),
    index('idx_accounts_provider_account').on(t.providerId, t.accountId),
    foreignKey({
      name: 'accounts_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_verification_tokens_identifier').on(t.identifier),
    index('idx_verification_tokens_expires_at').on(t.expiresAt),
  ],
)

export const twoFactorSecrets = pgTable(
  'two_factor_secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: uuid('user_id').notNull(),
    verified: boolean('verified').notNull().default(false),
  },
  (t) => [
    index('idx_two_factor_secrets_user_id').on(t.userId),
    foreignKey({
      name: 'two_factor_secrets_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles, { relationName: 'user_roles_user' }),
  assignedUserRoles: many(userRoles, { relationName: 'user_roles_assigned_by' }),
  rolesCreated: many(roles, { relationName: 'roles_created_by' }),
  rolesUpdated: many(roles, { relationName: 'roles_updated_by' }),
  sessions: many(sessions),
  accounts: many(accounts),
  twoFactorSecrets: many(twoFactorSecrets),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const twoFactorSecretsRelations = relations(twoFactorSecrets, ({ one }) => ({
  user: one(users, {
    fields: [twoFactorSecrets.userId],
    references: [users.id],
  }),
}))
