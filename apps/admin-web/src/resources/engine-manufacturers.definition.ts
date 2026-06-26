import { m } from '@mr/i18n'
import {
  EngineManufacturerCreateInputSchema,
  EngineManufacturerUpdateInputSchema,
  ResourceChangedKey,
  engineManufacturersReferenceOptions,
  type EngineManufacturerCreateInput,
  type EngineManufacturerListItem,
  type EngineManufacturerUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

export const engineManufacturersResourceDefinition: ResourceDefinition<
  EngineManufacturerListItem,
  EngineManufacturerCreateInput,
  EngineManufacturerUpdateInput
> = {
  resourceKey: ResourceChangedKey.EngineManufacturers,
  apiBase: '/api/engine-manufacturers',
  listQueryKeyPrefix: ['engine-manufacturers'],
  listQueryOptions: (filters) =>
    engineManufacturersReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<EngineManufacturerListItem>,
  columns: [
    {
      id: 'code',
      header: () => m.admin_engine_manufacturers_col_code(),
      cell: (item) => item.code,
    },
    {
      id: 'name',
      header: () => m.admin_engine_manufacturers_col_name(),
      cell: (item) => item.name,
    },
    {
      id: 'sortOrder',
      header: () => m.admin_engine_manufacturers_col_sort_order(),
      cell: (item) => String(item.sortOrder),
      cellClassName: 'tabular-nums',
    },
    {
      id: 'usageCount',
      header: () => m.field_usage_count(),
      cell: (item) => String(item.usageCount),
      cellClassName: 'tabular-nums',
    },
    {
      id: 'isActive',
      header: () => m.admin_engine_manufacturers_col_active(),
      cell: (item) =>
        item.isActive
          ? m.admin_engine_manufacturers_active_yes()
          : m.admin_engine_manufacturers_active_no(),
    },
  ],
  formFields: [
    {
      key: 'code',
      label: () => m.field_code(),
      type: 'text',
      createOnly: true,
      required: true,
    },
    {
      key: 'code',
      label: () => m.field_code(),
      type: 'readonly',
      editOnly: true,
    },
    {
      key: 'name',
      label: () => m.admin_engine_manufacturers_col_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'sortOrder',
      label: () => m.field_sort_order(),
      type: 'number',
    },
  ],
  createSchema:
    EngineManufacturerCreateInputSchema as unknown as z.ZodType<EngineManufacturerCreateInput>,
  updateSchema:
    EngineManufacturerUpdateInputSchema as unknown as z.ZodType<EngineManufacturerUpdateInput>,
  title: () => m.admin_engine_manufacturers_title(),
  subtitle: () => m.admin_engine_manufacturers_subtitle(),
  addLabel: () => m.admin_engine_manufacturers_add(),
  emptyLabel: () => m.admin_engine_manufacturers_empty(),
  createTitle: () => m.admin_engine_manufacturers_create_title(),
  editTitle: () => m.admin_engine_manufacturers_edit_title(),
  createSuccessMessage: () => m.admin_engine_manufacturers_create_success(),
  updateSuccessMessage: () => m.admin_engine_manufacturers_update_success(),
  deactivateTitle: () => m.admin_engine_manufacturers_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_engine_manufacturers_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_engine_manufacturers_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_engine_manufacturers_deactivate_success(),
  activeYesLabel: () => m.admin_engine_manufacturers_active_yes(),
  activeNoLabel: () => m.admin_engine_manufacturers_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    code: item?.code ?? '',
    name: item?.name ?? '',
    sortOrder: String(item?.sortOrder ?? 0),
  }),
  buildCreateBody: (values) => ({
    code: (values['code'] ?? '').trim(),
    name: (values['name'] ?? '').trim(),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.name,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.code, item.name].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_engine_manufacturers_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_engine_manufacturers_reactivate_description({ code: item.code }),
    reactivateConfirmLabel: () => m.admin_engine_manufacturers_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_engine_manufacturers_reactivate_success(),
    hardDeleteTitle: () => m.admin_engine_manufacturers_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_engine_manufacturers_hard_delete_description({ code: item.code }),
    hardDeleteConfirmLabel: () => m.admin_engine_manufacturers_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_engine_manufacturers_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
