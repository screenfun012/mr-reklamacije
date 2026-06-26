import { engineManufacturersReferenceOptions, type EngineManufacturerListItem } from '@mr/shared'

export type ResourceReferenceSelectKey = 'engine-manufacturers'

export interface ReferenceSelectOption {
  value: string
  label: string
  keywords?: string
}

interface ReferenceSelectConfig<TItem> {
  queryOptions: () => ReturnType<typeof engineManufacturersReferenceOptions>
  toOptions: (items: readonly TItem[]) => ReferenceSelectOption[]
}

export function getReferenceSelectConfig(
  key: ResourceReferenceSelectKey,
): ReferenceSelectConfig<EngineManufacturerListItem> {
  switch (key) {
    case 'engine-manufacturers':
      return {
        queryOptions: () => engineManufacturersReferenceOptions({ activeOnly: true }),
        toOptions: (items) =>
          items.map((item) => ({
            value: item.id,
            label: item.name,
            keywords: item.code,
          })),
      }
    default: {
      const exhaustive: never = key
      throw new Error(`Unknown reference select key: ${exhaustive}`)
    }
  }
}
