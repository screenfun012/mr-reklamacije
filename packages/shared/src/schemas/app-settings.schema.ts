import { z } from 'zod'

import { findAppSettingDefinition } from '../constants/app-settings.js'
import type { AppSettingKey } from '../constants/app-settings.js'
import { AppSettingValueType } from '../enums.js'

/**
 * What the database holds. A key is absent (or null) when it was never overridden or was reset —
 * both mean "use the default from the registry", so the reader is always `values[key] ?? default`.
 */
export type AppSettingValues = Partial<Record<AppSettingKey, string | null>>

export interface AppSettingsResponse {
  values: AppSettingValues
}

const MAX_VALUE_LENGTH = 500

/**
 * A partial patch: only the keys sent are touched, and `null` resets one to its default. The keys
 * are checked against the registry rather than an enum here so that an unknown key is a message the
 * admin can read, not a shape mismatch.
 */
export const AppSettingsUpdateSchema = z
  .object({
    values: z.record(z.string(), z.string().max(MAX_VALUE_LENGTH).nullable()),
  })
  .superRefine((input, ctx) => {
    for (const [key, value] of Object.entries(input.values)) {
      const definition = findAppSettingDefinition(key)

      if (definition === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['values', key],
          message: `Nepoznato podešavanje: ${key}`,
        })
        continue
      }

      // Reset to the registry default — no shape to check.
      if (value === null) continue

      if (definition.valueType === AppSettingValueType.Boolean) {
        if (value !== 'true' && value !== 'false') {
          ctx.addIssue({
            code: 'custom',
            path: ['values', key],
            message: 'Vrednost mora biti true ili false.',
          })
        }
        continue
      }

      if (value.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['values', key],
          message: 'Vrednost ne sme biti prazna. Koristi „Vrati na podrazumevano“.',
        })
        continue
      }

      if (definition.format === 'email' && !z.string().email().safeParse(value).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['values', key],
          message: 'Unesi ispravnu imejl adresu.',
        })
      }
    }
  })

export type AppSettingsUpdateInput = z.infer<typeof AppSettingsUpdateSchema>
