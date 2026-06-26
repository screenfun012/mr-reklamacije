import type { EngineTypeListItem } from '@mr/shared'
import type { SearchableSelectOption } from '@mr/ui'

export interface EngineTypeOrphanOption {
  id: string
  code: string
}

export function engineTypeToSearchableOption(item: EngineTypeListItem): SearchableSelectOption {
  return {
    value: item.id,
    label: item.code,
    keywords: item.code,
  }
}

export function buildEngineTypeSearchableOptions(
  items: readonly EngineTypeListItem[],
  selectedId: string,
  orphan?: EngineTypeOrphanOption,
): SearchableSelectOption[] {
  const options = items.map(engineTypeToSearchableOption)

  if (selectedId === '') {
    return options
  }

  if (options.some((option) => option.value === selectedId)) {
    return options
  }

  if (orphan !== undefined && orphan.id === selectedId) {
    return [
      {
        value: orphan.id,
        label: orphan.code,
        keywords: orphan.code,
      },
      ...options,
    ]
  }

  return options
}

export function isOrphanOnlyEngineTypeSelection(
  manufacturerId: string,
  selectedEngineTypeId: string,
  orphan?: EngineTypeOrphanOption,
): boolean {
  return (
    manufacturerId.trim() === '' &&
    selectedEngineTypeId.trim() !== '' &&
    orphan !== undefined &&
    orphan.id === selectedEngineTypeId
  )
}
