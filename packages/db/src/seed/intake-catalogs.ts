import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

/**
 * The vehicle-intake lists, seeded with exactly what the code carried before them (2026-08-11).
 *
 * The `code` values are the ones intake orders ALREADY store — `checklist` is a `{code: DA/NE}` map
 * and `damages[].type` holds the damage code — so seeding these is what makes existing orders read
 * correctly against the catalog. Change a code here and you orphan every order that used it.
 *
 * Names come in both languages because the printed work order is bilingual (V-7 decision ⑪): a row
 * with only a Serbian name prints Serbian onto an English document.
 */
interface CatalogSeed {
  code: string
  nameSr: string
  nameEn: string
  sortOrder: number
}

/** The order is the one the paper form uses, and the printed sheet keeps it (docs/25 §3.4). */
const CHECKLIST_ITEMS: CatalogSeed[] = [
  { code: 'rezervna', nameSr: 'Rezervna guma', nameEn: 'Spare tyre', sortOrder: 10 },
  { code: 'dizalica', nameSr: 'Dizalica', nameEn: 'Jack', sortOrder: 20 },
  { code: 'komplet', nameSr: 'Komplet dizalice', nameEn: 'Jack kit', sortOrder: 30 },
  {
    code: 'saobracajna',
    nameSr: 'Saobraćajna dozvola',
    nameEn: 'Vehicle registration',
    sortOrder: 40,
  },
  { code: 'vozacka', nameSr: 'Vozačka dozvola', nameEn: "Driver's licence", sortOrder: 50 },
  { code: 'prvaPomoc', nameSr: 'Prva pomoć', nameEn: 'First-aid kit', sortOrder: 60 },
  { code: 'prsluk', nameSr: 'Prsluk i trougao', nameEn: 'Hi-vis vest and triangle', sortOrder: 70 },
  { code: 'lanci', nameSr: 'Lanci / alat', nameEn: 'Chains / tools', sortOrder: 80 },
]

/**
 * Tones, not colours (see the schema). `ogrebotina` and `puknuto` are deliberately the same red —
 * the prototype does not distinguish them, and inventing a fifth hue here would be a decision
 * nobody made.
 */
const DAMAGE_TYPES: (CatalogSeed & { markerTone: string })[] = [
  { code: 'ogrebotina', nameSr: 'Ogrebotina', nameEn: 'Scratch', markerTone: 'red', sortOrder: 10 },
  { code: 'udubljenje', nameSr: 'Udubljenje', nameEn: 'Dent', markerTone: 'amber', sortOrder: 20 },
  { code: 'puknuto', nameSr: 'Puknuto', nameEn: 'Cracked', markerTone: 'red', sortOrder: 30 },
  { code: 'rdja', nameSr: 'Rđa', nameEn: 'Rust', markerTone: 'grey', sortOrder: 40 },
]

const ARRIVAL_MODES: CatalogSeed[] = [
  { code: 'dovezeno', nameSr: 'Dovezeno', nameEn: 'Driven in', sortOrder: 10 },
  { code: 'doslepano', nameSr: 'Došlepano', nameEn: 'Towed', sortOrder: 20 },
  { code: 'dovuceno', nameSr: 'Dovučeno', nameEn: 'Dragged', sortOrder: 30 },
]

export async function seedIntakeCatalogs(db: NodePgDatabase<typeof schema>): Promise<void> {
  const checklist = await db
    .insert(schema.intakeChecklistItems)
    .values(CHECKLIST_ITEMS)
    .onConflictDoNothing({ target: schema.intakeChecklistItems.code })
    .returning({ code: schema.intakeChecklistItems.code })

  const damageTypes = await db
    .insert(schema.intakeDamageTypes)
    .values(DAMAGE_TYPES)
    .onConflictDoNothing({ target: schema.intakeDamageTypes.code })
    .returning({ code: schema.intakeDamageTypes.code })

  const arrivalModes = await db
    .insert(schema.intakeArrivalModes)
    .values(ARRIVAL_MODES)
    .onConflictDoNothing({ target: schema.intakeArrivalModes.code })
    .returning({ code: schema.intakeArrivalModes.code })

  console.log(
    `[seed:intake-catalogs] Inserted ${checklist.length} / ${CHECKLIST_ITEMS.length} checklist items, ` +
      `${damageTypes.length} / ${DAMAGE_TYPES.length} damage types, ` +
      `${arrivalModes.length} / ${ARRIVAL_MODES.length} arrival modes`,
  )
}
