import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson, fetchParsed } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import type {
  IntakeOrdersSearch,
  IntakeOrderChangeStatusInput,
  IntakeOrderCreateInput,
  IntakeOrderDetail,
  IntakeOrderListQuery,
  IntakeOrderSignInput,
  IntakeOrderUpdateInput,
} from '../schemas/intake-order.wire.schema.js'
import {
  IntakeNumberCheckResponseSchema,
  IntakeOrderDetailSchema,
  IntakeOrderHistoryResponseSchema,
  IntakeOrderListResponseSchema,
  IntakeOrderSummarySchema,
  IntakePlateLookupResponseSchema,
} from '../schemas/intake-order.wire.schema.js'

const INTAKE_LIST_STALE_MS = 15_000
const INTAKE_DETAIL_STALE_MS = 15_000
/**
 * The number check and the plate lookup are keystroke-driven, so they cache briefly: a
 * serviser correcting a typo must not re-hit the server for every character, but a stale
 * "free" answer would let two intakes claim one number.
 */
const INTAKE_LOOKUP_STALE_MS = 5_000

/** The list's default page size — the shop does perhaps ten intakes a day. */
export const INTAKE_ORDERS_PAGE_SIZE = 25

export interface IntakeOrderListFilters {
  status?: IntakeOrderListQuery['status']
  search?: string
  unfinished?: boolean
  page?: number
  pageSize?: number
}

/** URL search params → list filters, so the route and the loader cannot drift apart. */
export function intakeFiltersFromSearch(search: IntakeOrdersSearch): IntakeOrderListFilters {
  return {
    ...(search.status !== undefined ? { status: search.status } : {}),
    ...(search.q !== undefined ? { search: search.q } : {}),
    ...(search.unfinished === true ? { unfinished: true } : {}),
    page: search.page ?? 1,
    pageSize: search.pageSize ?? INTAKE_ORDERS_PAGE_SIZE,
  }
}

export const intakeOrderKeys = {
  all: ['intake-orders'] as const,
  lists: () => [...intakeOrderKeys.all, 'list'] as const,
  list: (filters: IntakeOrderListFilters) => [...intakeOrderKeys.lists(), filters] as const,
  summary: () => [...intakeOrderKeys.all, 'summary'] as const,
  details: () => [...intakeOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...intakeOrderKeys.details(), id] as const,
  history: (id: string) => [...intakeOrderKeys.all, 'history', id] as const,
  numberCheck: (value: string) => [...intakeOrderKeys.all, 'number-check', value] as const,
  plateLookup: (value: string) => [...intakeOrderKeys.all, 'plate-lookup', value] as const,
}

function buildListQuery(filters: IntakeOrderListFilters): string {
  const query = new URLSearchParams()
  if (filters.status !== undefined) {
    query.set('status', filters.status)
  }
  if (filters.search !== undefined && filters.search.length > 0) {
    query.set('search', filters.search)
  }
  if (filters.unfinished === true) {
    query.set('unfinished', 'true')
  }
  query.set('page', String(filters.page ?? 1))
  if (filters.pageSize !== undefined) {
    query.set('pageSize', String(filters.pageSize))
  }
  return query.toString()
}

/**
 * The "Servis" list. Scope is the server's call: a caller limited to `intake_orders.view_own`
 * gets their own orders including unfinished ones, everyone else gets the shop's signed
 * orders unless `unfinished` asks for the drafts.
 */
export function intakeOrdersListOptions(filters: IntakeOrderListFilters) {
  return queryOptions({
    queryKey: intakeOrderKeys.list(filters),
    queryFn: () =>
      fetchParsed(`/api/intake-orders?${buildListQuery(filters)}`, IntakeOrderListResponseSchema),
    staleTime: INTAKE_LIST_STALE_MS,
    placeholderData: keepPreviousData,
  })
}

/** The four KPI cards. Signed orders only — drafts must not inflate "Primljeno". */
export function intakeOrderSummaryOptions() {
  return queryOptions({
    queryKey: intakeOrderKeys.summary(),
    queryFn: () => fetchParsed('/api/intake-orders/summary', IntakeOrderSummarySchema),
    staleTime: INTAKE_LIST_STALE_MS,
  })
}

/** One aggregate fetch: the order plus its photos. */
export function intakeOrderDetailOptions(id: string) {
  return queryOptions({
    queryKey: intakeOrderKeys.detail(id),
    queryFn: () => fetchParsed(`/api/intake-orders/${id}`, IntakeOrderDetailSchema),
    staleTime: INTAKE_DETAIL_STALE_MS,
  })
}

/**
 * Is this order number already taken? Four outcomes, one of which ("your own unfinished
 * intake") is an offer to resume rather than an error.
 */
/** The order's history, as the detail's Istorija tab reads it. */
export function intakeOrderHistoryOptions(id: string) {
  return queryOptions({
    queryKey: intakeOrderKeys.history(id),
    queryFn: () =>
      fetchParsed(`/api/intake-orders/${id}/history`, IntakeOrderHistoryResponseSchema),
    staleTime: INTAKE_DETAIL_STALE_MS,
  })
}

export function intakeNumberCheckOptions(orderNumber: string) {
  const trimmed = orderNumber.trim()
  const query = new URLSearchParams({ number: trimmed })

  return queryOptions({
    queryKey: intakeOrderKeys.numberCheck(trimmed),
    queryFn: () =>
      fetchParsed(
        `/api/intake-orders/check-number?${query.toString()}`,
        IntakeNumberCheckResponseSchema,
      ),
    staleTime: INTAKE_LOOKUP_STALE_MS,
    enabled: trimmed.length > 0,
  })
}

/** Has this plate been through the shop before? Offers the previous owner/vehicle data. */
export function intakePlateLookupOptions(plate: string) {
  const trimmed = plate.trim()
  const query = new URLSearchParams({ plate: trimmed })

  return queryOptions({
    queryKey: intakeOrderKeys.plateLookup(trimmed),
    queryFn: () =>
      fetchParsed(`/api/intake-orders/lookup?${query.toString()}`, IntakePlateLookupResponseSchema),
    staleTime: INTAKE_LOOKUP_STALE_MS,
    enabled: trimmed.length >= 2,
  })
}

export function createIntakeOrder(input: IntakeOrderCreateInput): Promise<IntakeOrderDetail> {
  return fetchJson<IntakeOrderDetail>('/api/intake-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateIntakeOrder(
  id: string,
  input: IntakeOrderUpdateInput,
): Promise<IntakeOrderDetail> {
  return fetchJson<IntakeOrderDetail>(`/api/intake-orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** Both signatures in, intake finished — the order becomes visible to the office. */
export function signIntakeOrder(
  id: string,
  input: IntakeOrderSignInput,
): Promise<IntakeOrderDetail> {
  return fetchJson<IntakeOrderDetail>(`/api/intake-orders/${id}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** The serviser's one-way button: next status, never back. */
export function advanceIntakeOrder(id: string): Promise<IntakeOrderDetail> {
  return fetchJson<IntakeOrderDetail>(`/api/intake-orders/${id}/advance`, { method: 'POST' })
}

/** Office correction of a mis-tap — any status, recorded in the history. */
export function changeIntakeOrderStatus(
  id: string,
  input: IntakeOrderChangeStatusInput,
): Promise<IntakeOrderDetail> {
  return fetchJson<IntakeOrderDetail>(`/api/intake-orders/${id}/change-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/**
 * Removes an order from the list. An unfinished one is really deleted (`ODUSTANI`); a signed
 * one is soft-deleted, because it is evidence.
 */
export function deleteIntakeOrder(id: string): Promise<void> {
  return fetchNoContent(`/api/intake-orders/${id}`, { method: 'DELETE' })
}

export function deleteIntakeOrderPhoto(id: string, attachmentId: string): Promise<void> {
  return fetchNoContent(`/api/intake-orders/${id}/photos/${attachmentId}`, { method: 'DELETE' })
}

/**
 * Intake photos are served by the intake module, never by `/api/attachments` — a serviser
 * must not hold a permission that would also reach a claim's files.
 */
export function buildIntakePhotoUrl(
  id: string,
  attachmentId: string,
  variant?: 'thumbnail',
): string {
  const suffix = variant === 'thumbnail' ? '?variant=thumbnail' : ''
  return `/api/intake-orders/${id}/photos/${attachmentId}${suffix}`
}
