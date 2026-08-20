import { m } from '@mr/i18n'

import { renderActiveCell } from '~/lib/resource/resource-active-cell'
import {
  ClaimCategoryCreateInputSchema,
  ClaimCategoryUpdateInputSchema,
  ResourceChangedKey,
  claimCategoriesReferenceOptions,
  type ClaimCategoryCreateInput,
  type ClaimCategoryListItem,
  type ClaimCategoryUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  // Strict full-string parse: a separated value like "1.998" / "1,998" / "1 998" is
  // REJECTED (undefined), not silently truncated to 1 the way Number.parseInt would.
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) ? parsed : undefined
}

export const claimCategoriesResourceDefinition: ResourceDefinition<
  ClaimCategoryListItem,
  ClaimCategoryCreateInput,
  ClaimCategoryUpdateInput
> = {
  resourceKey: ResourceChangedKey.ClaimCategories,
  apiBase: '/api/claim-categories',
  listQueryKeyPrefix: ['claim-categories'],
  listQueryOptions: (filters) =>
    claimCategoriesReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<ClaimCategoryListItem>,
  columns: [
    {
      id: 'code',
      header: () => m.field_code(),
      cell: (item) => item.code,
    },
    {
      id: 'name',
      header: () => m.field_name(),
      cell: (item) => item.name,
    },
    {
      id: 'sortOrder',
      header: () => m.field_sort_order(),
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
      header: () => m.field_active(),
      cell: (item) =>
        renderActiveCell(
          item.isActive,
          item.isActive
            ? m.admin_claim_categories_active_yes()
            : m.admin_claim_categories_active_no(),
        ),
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
      label: () => m.field_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'sortOrder',
      label: () => m.field_sort_order(),
      type: 'number',
    },
  ],
  createSchema: ClaimCategoryCreateInputSchema as unknown as z.ZodType<ClaimCategoryCreateInput>,
  updateSchema: ClaimCategoryUpdateInputSchema as unknown as z.ZodType<ClaimCategoryUpdateInput>,
  title: () => m.admin_claim_categories_title(),
  subtitle: () => m.admin_claim_categories_subtitle(),
  addLabel: () => m.admin_claim_categories_add(),
  emptyLabel: () => m.admin_claim_categories_empty(),
  createTitle: () => m.admin_claim_categories_create_title(),
  editTitle: () => m.admin_claim_categories_edit_title(),
  createSuccessMessage: () => m.admin_claim_categories_create_success(),
  updateSuccessMessage: () => m.admin_claim_categories_update_success(),
  deactivateTitle: () => m.admin_claim_categories_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_claim_categories_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_claim_categories_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_claim_categories_deactivate_success(),
  activeYesLabel: () => m.admin_claim_categories_active_yes(),
  activeNoLabel: () => m.admin_claim_categories_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    code: item?.code ?? '',
    name: item?.name ?? '',
    sortOrder: item?.sortOrder !== undefined ? String(item.sortOrder) : '',
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
    reactivateTitle: () => m.admin_claim_categories_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_claim_categories_reactivate_description({ name: item.name }),
    reactivateConfirmLabel: () => m.admin_claim_categories_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_claim_categories_reactivate_success(),
    hardDeleteTitle: () => m.admin_claim_categories_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_claim_categories_hard_delete_description({ name: item.name }),
    hardDeleteConfirmLabel: () => m.admin_claim_categories_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_claim_categories_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
