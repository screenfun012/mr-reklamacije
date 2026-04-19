import { index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * OpenAI translation cache — content-addressed by hash + language pair. No FK to claims.
 */
export const translationCache = pgTable(
  'translation_cache',
  {
    sourceHash: text('source_hash').notNull(),
    sourceLanguage: text('source_language').notNull(),
    targetLanguage: text('target_language').notNull(),
    sourceText: text('source_text').notNull(),
    translatedText: text('translated_text').notNull(),
    model: text('model').notNull(),
    tokensUsed: integer('tokens_used'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    accessCount: integer('access_count').notNull().default(1),
  },
  (t) => [
    primaryKey({
      columns: [t.sourceHash, t.sourceLanguage, t.targetLanguage],
    }),
    index('idx_translation_cache_last_accessed_at').on(t.lastAccessedAt),
  ],
)
