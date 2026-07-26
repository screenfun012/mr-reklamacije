import { z } from 'zod'

import { intakeDamageTypeValues } from '../enums.js'

/**
 * The eight equipment items a serviser ticks off at intake, in the order they
 * appear on the paper form. `null` means "not checked either way" — a serviser
 * who never touched the row must not read as "missing", because the printed
 * document is evidence.
 */
export const INTAKE_CHECKLIST_KEYS = [
  'rezervna',
  'dizalica',
  'komplet',
  'saobracajna',
  'vozacka',
  'prvaPomoc',
  'prsluk',
  'lanci',
] as const

export type IntakeChecklistKey = (typeof INTAKE_CHECKLIST_KEYS)[number]

export const IntakeChecklistSchema = z.object(
  Object.fromEntries(INTAKE_CHECKLIST_KEYS.map((key) => [key, z.boolean().nullable()])) as Record<
    IntakeChecklistKey,
    z.ZodNullable<z.ZodBoolean>
  >,
)

export type IntakeChecklist = z.infer<typeof IntakeChecklistSchema>

/** The damage map's coordinate space — the silhouette's own viewBox, never screen pixels. */
export const INTAKE_DAMAGE_MAP_WIDTH = 340
export const INTAKE_DAMAGE_MAP_HEIGHT = 556

/**
 * One marker on the damage map. Coordinates live in the drawing's space so a
 * marker sits in the same place on tablet, desktop and paper. `id` is stable so
 * a photo can point at this damage even after the list is reordered; `zone` is
 * the human name derived from (vehicleType, x, y) at marking time and is what
 * gets printed.
 */
export const IntakeDamageSchema = z.object({
  id: z.string().trim().min(1).max(40),
  type: z.enum(intakeDamageTypeValues),
  x: z.number().min(0).max(INTAKE_DAMAGE_MAP_WIDTH),
  y: z.number().min(0).max(INTAKE_DAMAGE_MAP_HEIGHT),
  zone: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
})

export type IntakeDamage = z.infer<typeof IntakeDamageSchema>

/** Array order IS the ①②③ numbering shown on the map, in the list and on the print. */
export const IntakeDamagesSchema = z.array(IntakeDamageSchema)
