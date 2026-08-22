import { m } from '@mr/i18n'

import { renderActiveCell } from '~/lib/resource/resource-active-cell'
import { parseOptionalInt } from '~/lib/resource/parse-optional-int'
import {
  ClaimCategoryFieldOptionCreateInputSchema,
  ClaimCategoryFieldOptionUpdateInputSchema,
  ResourceChangedKey,
  claimCategoryFieldOptionsReferenceOptions,
  type ClaimCategoryFieldOptionCreateInput,
  type ClaimCategoryFieldOptionListItem,
  type ClaimCategoryFieldOptionUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

export const claimCategoryFieldOptionsResourceDefinition: ResourceDefinition<
  ClaimCategoryFieldOptionListItem,
  ClaimCategoryFieldOptionCreateInput,
  ClaimCategoryFieldOptionUpdateInput
> = {
  // Same one key as the fields above — see that file's note.
  resourceKey: ResourceChangedKey.ClaimCategories,
  apiBase: '/api/claim-category-field-options',
  listQueryKeyPrefix: ['claim-category-field-options'],
  listQueryOptions: (filters) =>
    claimCategoryFieldOptionsReferenceOptions({
      activeOnly: filters?.activeOnly ?? false,
    }) as unknown as ResourceListQueryOptions<ClaimCategoryFieldOptionListItem>,
  columns: [
    {
      id: 'field',
      header: () => m.field_claim_category_field(),
      cell: (item) => item.fieldName,
    },
    {
      id: 'parent',
      header: () => m.field_claim_category_field_option_parent(),
      cell: (item) => item.parentOptionCode ?? m.admin_claim_category_field_options_parent_none(),
    },
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
            ? m.admin_claim_category_field_options_active_yes()
            : m.admin_claim_category_field_options_active_no(),
        ),
    },
  ],
  formFields: [
    {
      key: 'fieldId',
      label: () => m.field_claim_category_field(),
      type: 'reference-select',
      referenceKey: 'claim-category-fields',
      createOnly: true,
      required: true,
      hint: () => m.admin_claim_category_field_options_field_hint(),
    },
    {
      key: 'code',
      label: () => m.field_code(),
      type: 'text',
      createOnly: true,
      required: true,
      hint: () => m.admin_claim_category_field_options_code_hint(),
    },
    {
      key: 'name',
      label: () => m.field_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'parentOptionId',
      label: () => m.field_claim_category_field_option_parent(),
      type: 'reference-select',
      referenceKey: 'claim-category-field-options',
      hint: () => m.admin_claim_category_field_options_parent_hint(),
    },
    {
      key: 'sortOrder',
      label: () => m.field_sort_order(),
      type: 'number',
    },
  ],
  createSchema:
    ClaimCategoryFieldOptionCreateInputSchema as unknown as z.ZodType<ClaimCategoryFieldOptionCreateInput>,
  updateSchema:
    ClaimCategoryFieldOptionUpdateInputSchema as unknown as z.ZodType<ClaimCategoryFieldOptionUpdateInput>,
  title: () => m.admin_claim_category_field_options_title(),
  subtitle: () => m.admin_claim_category_field_options_subtitle(),
  addLabel: () => m.admin_claim_category_field_options_add(),
  emptyLabel: () => m.admin_claim_category_field_options_empty(),
  createTitle: () => m.admin_claim_category_field_options_create_title(),
  editTitle: () => m.admin_claim_category_field_options_edit_title(),
  createSuccessMessage: () => m.admin_claim_category_field_options_create_success(),
  updateSuccessMessage: () => m.admin_claim_category_field_options_update_success(),
  deactivateTitle: () => m.admin_claim_category_field_options_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_claim_category_field_options_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_claim_category_field_options_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_claim_category_field_options_deactivate_success(),
  activeYesLabel: () => m.admin_claim_category_field_options_active_yes(),
  activeNoLabel: () => m.admin_claim_category_field_options_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    fieldId: item?.fieldId ?? '',
    parentOptionId: item?.parentOptionId ?? '',
    code: item?.code ?? '',
    name: item?.name ?? '',
    sortOrder: item?.sortOrder !== undefined ? String(item.sortOrder) : '',
  }),
  buildCreateBody: (values) => ({
    fieldId: (values['fieldId'] ?? '').trim(),
    code: (values['code'] ?? '').trim(),
    name: (values['name'] ?? '').trim(),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
    // Absent, not null: an option that hangs off nothing is simply always offered.
    ...(values['parentOptionId'] !== undefined && values['parentOptionId'].length > 0
      ? { parentOptionId: values['parentOptionId'] }
      : {}),
  }),
  buildUpdateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
    // `null`, not absent: clearing the picker has to be able to REMOVE a dependency, and an
    // absent key means "leave it as it is".
    parentOptionId:
      values['parentOptionId'] !== undefined && values['parentOptionId'].length > 0
        ? values['parentOptionId']
        : null,
  }),
  getDeactivateTargetLabel: (item) => item.name,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.fieldName, item.code, item.name].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_claim_category_field_options_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_claim_category_field_options_reactivate_description({ name: item.name }),
    reactivateConfirmLabel: () => m.admin_claim_category_field_options_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_claim_category_field_options_reactivate_success(),
    hardDeleteTitle: () => m.admin_claim_category_field_options_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_claim_category_field_options_hard_delete_description({ name: item.name }),
    hardDeleteConfirmLabel: () => m.admin_claim_category_field_options_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_claim_category_field_options_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
