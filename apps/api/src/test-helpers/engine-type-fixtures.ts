import type { EngineTypeListItem } from '@mr/shared'

import type { Container } from '../core/container.js'

export async function ensureTestEngineManufacturerId(
  container: Container,
  code = 'TEST-BMW',
  name = 'BMW',
): Promise<string> {
  const list = await container.engineManufacturersRepository.list({ activeOnly: false, limit: 50 })
  const existing = list.items.find((item) => item.code === code)
  if (existing !== undefined) {
    return existing.id
  }

  const created = await container.engineManufacturersRepository.create({ code, name })
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
