import type { QueryKey, UseSuspenseQueryOptions } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { z } from 'zod'

export type ResourceFormFieldType = 'text' | 'number' | 'textarea' | 'readonly'

export interface ResourceFormFieldDef {
  key: string
  label: () => string
  type: ResourceFormFieldType
  /** Shown only in create dialog (e.g. code). */
  createOnly?: boolean
  /** Hidden in create dialog. */
  editOnly?: boolean
  /** When true, empty value blocks submit. */
  required?: boolean
}

export interface ResourceColumnDef<TItem> {
  id: string
  header: () => string
  cell: (item: TItem) => ReactNode
  headerClassName?: string
  cellClassName?: string
}

export type ResourceListQueryOptions<TItem> = Pick<
  UseSuspenseQueryOptions<readonly TItem[], Error, readonly TItem[], QueryKey>,
  'queryKey' | 'queryFn' | 'staleTime' | 'gcTime'
>

export interface ResourceLifecycleLabels<TItem> {
  getUsageCount: (item: TItem) => number
  reactivateTitle: () => string
  reactivateDescription: (item: TItem) => string
  reactivateConfirmLabel: () => string
  reactivateSuccessMessage: () => string
  hardDeleteTitle: () => string
  hardDeleteDescription: (item: TItem) => string
  hardDeleteConfirmLabel: () => string
  hardDeleteSuccessMessage: () => string
  hardDeleteBlockedTooltip: (item: TItem) => string
}

export interface ResourceDefinition<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  resourceKey: string
  apiBase: string
  listQueryKeyPrefix: readonly string[]
  listQueryOptions: (filters?: { activeOnly?: boolean }) => ResourceListQueryOptions<TItem>
  columns: ResourceColumnDef<TItem>[]
  formFields: ResourceFormFieldDef[]
  createSchema: z.ZodType<TCreate>
  updateSchema: z.ZodType<TUpdate>
  title: () => string
  subtitle: () => string
  addLabel: () => string
  emptyLabel: () => string
  createTitle: () => string
  editTitle: () => string
  createSuccessMessage: () => string
  updateSuccessMessage: () => string
  deactivateTitle: () => string
  deactivateDescription: (item: TItem) => string
  deactivateConfirmLabel: () => string
  deactivateSuccessMessage: () => string
  activeYesLabel: () => string
  activeNoLabel: () => string
  editActionLabel: () => string
  getInitialFormValues: (item?: TItem) => Record<string, string>
  buildCreateBody: (values: Record<string, string>) => TCreate
  buildUpdateBody: (values: Record<string, string>) => TUpdate
  getDeactivateTargetLabel: (item: TItem) => string
  lifecycle?: ResourceLifecycleLabels<TItem>
}
