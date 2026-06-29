import { m } from '@mr/i18n'
import {
  ExternalPartyCreateInputSchema,
  ExternalPartyKind,
  ExternalPartyUpdateInputSchema,
  ResourceChangedKey,
  externalPartiesReferenceOptions,
  type ExternalPartyCreateInput,
  type ExternalPartyListItem,
  type ExternalPartyUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type {
  ResourceDefinition,
  ResourceListQueryOptions,
  ResourceSelectOption,
} from '~/lib/resource/types.js'

function kindOptions(): readonly ResourceSelectOption[] {
  return [
    { value: ExternalPartyKind.Supplier, label: m.external_party_kind_supplier() },
    { value: ExternalPartyKind.Subcontractor, label: m.external_party_kind_subcontractor() },
    { value: ExternalPartyKind.Manufacturer, label: m.external_party_kind_manufacturer() },
    { value: ExternalPartyKind.Other, label: m.external_party_kind_other() },
  ]
}

function kindLabel(kind: string): string {
  return kindOptions().find((option) => option.value === kind)?.label ?? kind
}

function toKind(value: string): ExternalPartyCreateInput['kind'] {
  const match = kindOptions().find((option) => option.value === value)
  return (match?.value ?? ExternalPartyKind.Other) as ExternalPartyCreateInput['kind']
}

export const externalPartiesResourceDefinition: ResourceDefinition<
  ExternalPartyListItem,
  ExternalPartyCreateInput,
  ExternalPartyUpdateInput
> = {
  resourceKey: ResourceChangedKey.ExternalParties,
  apiBase: '/api/external-parties',
  listQueryKeyPrefix: ['external-parties'],
  listQueryOptions: (filters) =>
    externalPartiesReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<ExternalPartyListItem>,
  columns: [
    {
      id: 'name',
      header: () => m.field_name(),
      cell: (item) => item.name,
    },
    {
      id: 'kind',
      header: () => m.field_kind(),
      cell: (item) => kindLabel(item.kind),
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
        item.isActive
          ? m.admin_external_parties_active_yes()
          : m.admin_external_parties_active_no(),
    },
  ],
  formFields: [
    {
      key: 'name',
      label: () => m.field_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'kind',
      label: () => m.field_kind(),
      type: 'select',
      required: true,
      options: kindOptions,
    },
  ],
  createSchema: ExternalPartyCreateInputSchema as unknown as z.ZodType<ExternalPartyCreateInput>,
  updateSchema: ExternalPartyUpdateInputSchema as unknown as z.ZodType<ExternalPartyUpdateInput>,
  title: () => m.admin_external_parties_title(),
  subtitle: () => m.admin_external_parties_subtitle(),
  addLabel: () => m.admin_external_parties_add(),
  emptyLabel: () => m.admin_external_parties_empty(),
  createTitle: () => m.admin_external_parties_create_title(),
  editTitle: () => m.admin_external_parties_edit_title(),
  createSuccessMessage: () => m.admin_external_parties_create_success(),
  updateSuccessMessage: () => m.admin_external_parties_update_success(),
  deactivateTitle: () => m.admin_external_parties_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_external_parties_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_external_parties_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_external_parties_deactivate_success(),
  activeYesLabel: () => m.admin_external_parties_active_yes(),
  activeNoLabel: () => m.admin_external_parties_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    name: item?.name ?? '',
    kind: item?.kind ?? ExternalPartyKind.Supplier,
  }),
  buildCreateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    kind: toKind(values['kind'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    kind: toKind(values['kind'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.name,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.name, kindLabel(item.kind)].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_external_parties_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_external_parties_reactivate_description({ name: item.name }),
    reactivateConfirmLabel: () => m.admin_external_parties_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_external_parties_reactivate_success(),
    hardDeleteTitle: () => m.admin_external_parties_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_external_parties_hard_delete_description({ name: item.name }),
    hardDeleteConfirmLabel: () => m.admin_external_parties_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_external_parties_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
