import type { EngineTypeListItem } from '@mr/shared'
import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { Container } from '../core/container.js'
import { uniqueFixtureEngineManufacturerCode } from './engine-manufacturer-cleanup.js'

export async function ensureTestEngineManufacturerId(
  container: Container,
  code?: string,
  name = 'Test Manufacturer',
): Promise<string> {
  const resolvedCode = code ?? uniqueFixtureEngineManufacturerCode()

  const list = await container.engineManufacturersRepository.list({ activeOnly: false, limit: 50 })
  const existing = list.items.find((item) => item.code === resolvedCode)
  if (existing !== undefined) {
    return existing.id
  }

  const created = await container.engineManufacturersRepository.create({
    code: resolvedCode,
    name,
  })
  return created.id
}

export async function createTestEngineType(
  container: Container,
  code: string,
  manufacturerId?: string,
): Promise<EngineTypeListItem> {
  const resolvedManufacturerId = manufacturerId ?? (await ensureTestEngineManufacturerId(container))
  return container.engineTypesRepository.create({
    code,
    manufacturerId: resolvedManufacturerId,
  })
}

export async function createLegacyEngineTypeWithoutManufacturer(
  db: NodePgDatabase<typeof schema>,
  code: string,
): Promise<string> {
  const [row] = await db
    .insert(schema.engineTypes)
    .values({
      code,
      isActive: true,
      manufacturerId: null,
    })
    .returning({ id: schema.engineTypes.id })

  if (row === undefined) {
    throw new Error('Failed to insert legacy engine type fixture')
  }

  return row.id
}
