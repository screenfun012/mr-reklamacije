import { ValidationError } from '../errors/domain-errors.js'

export async function validateEngineTypeManufacturerPair(
  getEngineTypeManufacturerId: (engineTypeId: string) => Promise<string | null>,
  engineTypeId: string,
  manufacturerId: string,
): Promise<void> {
  const typeManufacturerId = await getEngineTypeManufacturerId(engineTypeId)

  // Legacy engine types without manufacturer FK — allow orphan edits.
  if (typeManufacturerId === null) {
    return
  }

  if (typeManufacturerId !== manufacturerId) {
    throw new ValidationError('Engine type does not belong to the selected manufacturer')
  }
}
