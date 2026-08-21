import { m } from '@mr/i18n'

import { renderActiveCell } from '~/lib/resource/resource-active-cell'
import { parseOptionalInt } from '~/lib/resource/parse-optional-int'
import {
  ClaimCategoryFieldCreateInputSchema,
  ClaimCategoryFieldUpdateInputSchema,
  ResourceChangedKey,
  claimCategoryFieldsReferenceOptions,
  type ClaimCategoryFieldCreateInput,
  type ClaimCategoryFieldListItem,
  type ClaimCategoryFieldUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

export const claimCategoryFieldsResourceDefinition: ResourceDefinition<
  ClaimCategoryFieldListItem,
  ClaimCategoryFieldCreateInput,
  ClaimCategoryFieldUpdateInput
> = {
  // One key for the whole category family: a field, an option and a category all move the same
  // screens, so they share the signal rather than inventing three.
  resourceKey: ResourceChangedKey.ClaimCategories,
  apiBase: '/api/claim-category-fields',
  listQueryKeyPrefix: ['claim-category-fields'],
  listQueryOptions: (filters) =>
    claimCategoryFieldsReferenceOptions({
      activeOnly: filters?.activeOnly ?? false,
    }) as unknown as ResourceListQueryOptions<ClaimCategoryFieldListItem>,
  columns: [
    {
      id: 'category',
      header: () => m.field_claim_category(),
      cell: (item) => item.categoryName,
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
      id: 'fieldType',
      header: () => m.admin_claim_category_fields_type(),
      cell: (item) =>
        item.fieldType === 'text'
          ? m.admin_claim_category_fields_type_text()
          : m.admin_claim_category_fields_type_select(),
    },
    {
      id: 'isRequired',
      header: () => m.admin_claim_category_fields_required(),
      cell: (item) =>
        item.isRequired
          ? m.admin_claim_category_fields_answer_yes()
          : m.admin_claim_category_fields_answer_no(),
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
            ? m.admin_claim_category_fields_active_yes()
            : m.admin_claim_category_fields_active_no(),
        ),
    },
  ],
  formFields: [
    {
      key: 'categoryId',
      label: () => m.field_claim_category(),
      type: 'reference-select',
      referenceKey: 'claim-categories',
      createOnly: true,
      required: true,
      hint: () => m.admin_claim_category_fields_category_hint(),
    },
    {
      key: 'code',
      label: () => m.field_code(),
      type: 'text',
      createOnly: true,
      required: true,
      hint: () => m.admin_claim_category_fields_code_hint(),
    },
    {
      key: 'name',
      label: () => m.field_name(),
      type: 'text',
      required: true,
    },
    {
      // Fixed once created: answers are already stored against it, and switching a select to a
      // text field would leave option codes standing in for typed words.
      key: 'fieldType',
      label: () => m.admin_claim_category_fields_type(),
      type: 'select',
      createOnly: true,
      options: () => [
        { value: 'select', label: m.admin_claim_category_fields_type_select() },
        { value: 'text', label: m.admin_claim_category_fields_type_text() },
      ],
      hint: () => m.admin_claim_category_fields_type_hint(),
    },
    {
      key: 'isRequired',
      label: () => m.admin_claim_category_fields_required(),
      type: 'select',
      options: () => [
        { value: 'false', label: m.admin_claim_category_fields_answer_no() },
        { value: 'true', label: m.admin_claim_category_fields_answer_yes() },
      ],
      hint: () => m.admin_claim_category_fields_required_hint(),
    },
    {
      key: 'sortOrder',
      label: () => m.field_sort_order(),
      type: 'number',
    },
  ],
  createSchema:
    ClaimCategoryFieldCreateInputSchema as unknown as z.ZodType<ClaimCategoryFieldCreateInput>,
  updateSchema:
    ClaimCategoryFieldUpdateInputSchema as unknown as z.ZodType<ClaimCategoryFieldUpdateInput>,
  title: () => m.admin_claim_category_fields_title(),
  subtitle: () => m.admin_claim_category_fields_subtitle(),
  addLabel: () => m.admin_claim_category_fields_add(),
  emptyLabel: () => m.admin_claim_category_fields_empty(),
  createTitle: () => m.admin_claim_category_fields_create_title(),
  editTitle: () => m.admin_claim_category_fields_edit_title(),
  createSuccessMessage: () => m.admin_claim_category_fields_create_success(),
  updateSuccessMessage: () => m.admin_claim_category_fields_update_success(),
  deactivateTitle: () => m.admin_claim_category_fields_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_claim_category_fields_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_claim_category_fields_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_claim_category_fields_deactivate_success(),
  activeYesLabel: () => m.admin_claim_category_fields_active_yes(),
  activeNoLabel: () => m.admin_claim_category_fields_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    categoryId: item?.categoryId ?? '',
    code: item?.code ?? '',
    name: item?.name ?? '',
    fieldType: item?.fieldType ?? 'select',
    isRequired: item?.isRequired === true ? 'true' : 'false',
    sortOrder: item?.sortOrder !== undefined ? String(item.sortOrder) : '',
  }),
  buildCreateBody: (values) => ({
    categoryId: (values['categoryId'] ?? '').trim(),
    code: (values['code'] ?? '').trim(),
    name: (values['name'] ?? '').trim(),
    fieldType: values['fieldType'] === 'text' ? 'text' : 'select',
    isRequired: values['isRequired'] === 'true',
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    isRequired: values['isRequired'] === 'true',
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.name,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.categoryName, item.code, item.name].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_claim_category_fields_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_claim_category_fields_reactivate_description({ name: item.name }),
    reactivateConfirmLabel: () => m.admin_claim_category_fields_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_claim_category_fields_reactivate_success(),
    hardDeleteTitle: () => m.admin_claim_category_fields_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_claim_category_fields_hard_delete_description({ name: item.name }),
    hardDeleteConfirmLabel: () => m.admin_claim_category_fields_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_claim_category_fields_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
