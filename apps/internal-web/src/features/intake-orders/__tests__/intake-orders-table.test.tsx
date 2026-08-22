import { m, setLocale } from '@mr/i18n'
import { IntakeOrderStatus, IntakeVehicleType, type IntakeOrderListItem } from '@mr/shared'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ArchiveRestore, Trash2 } from 'lucide-react'

import { IntakeOrdersTable, type IntakeRowAction } from '../intake-orders-table.js'

const order: IntakeOrderListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'RN-0950/26',
  status: IntakeOrderStatus.Received,
  receivedAt: '2026-07-27T18:42:00.000Z',
  vehicleType: IntakeVehicleType.Car,
  plate: 'BG-950-AA',
  vehicle: 'Opel Astra',
  ownerName: 'Brzi kurir doo',
  contactPhone: null,
  technicianId: '99999999-9999-4999-8999-999999999999',
  technicianName: 'Nikola Admin',
  archivedAt: null,
  damageCount: 1,
  photoCount: 3,
  signedAt: '2026-07-27T19:10:00.000Z',
  draftStep: null,
  photosPending: 0,
}

async function renderTable(
  items: readonly IntakeOrderListItem[],
  rowAction: (item: IntakeOrderListItem) => IntakeRowAction | null = () => null,
): Promise<void> {
  const rootRoute = createRootRoute({
    component: () => <IntakeOrdersTable items={items} rowAction={rowAction} />,
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/prijem/$id',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router as never} />)
}

/** The width both layouts must agree on: the table's own arithmetic (924 + 78 + 36 + 40 slot). */
const SWITCH_WIDTH = 1078

function switchWidthOf(className: string, variant: 'grid' | 'hidden'): number | null {
  const match = new RegExp(`@min-\\[(\\d+)px\\]:${variant}\\b`).exec(className)
  return match?.[1] === undefined ? null : Number(match[1])
}

/*
 * jsdom does not do layout and does not evaluate container queries, so these assert the
 * declarations rather than the rendered result — deliberately. The alternative for a
 * CSS-only behaviour is no guard at all, and the failure this protects against is silent:
 * the row and the card can only ever be swapped by CSS, so a half-finished edit shows
 * BOTH or NEITHER on a real screen while every behavioural test stays green.
 * The measured proof that the switch works lives in the spec (2026-07-30 layout frame).
 */
describe('IntakeOrdersTable — the row and the card are one list in two shapes', () => {
  it('renders every value twice, so the card cannot be deleted unnoticed', async () => {
    setLocale('sr')
    await renderTable([order])

    // Once in the wide row, once in the narrow card. Drop either layout and this goes to 1.
    expect(screen.getAllByText(order.orderNumber)).toHaveLength(2)
    expect(screen.getAllByText(order.plate)).toHaveLength(2)
    expect(screen.getAllByText(order.technicianName)).toHaveLength(2)
  })

  it('hides the card at exactly the width the row starts at', async () => {
    setLocale('sr')
    await renderTable([order])

    const link = screen.getAllByRole('link')[0]
    expect(link).toBeDefined()
    const [row, card] = Array.from(link?.children ?? [])
    expect(row).toBeDefined()
    expect(card).toBeDefined()

    // Three places carry this number; an edit that misses one shows both layouts at once.
    expect(switchWidthOf(row?.className ?? '', 'grid')).toBe(SWITCH_WIDTH)
    expect(switchWidthOf(card?.className ?? '', 'hidden')).toBe(SWITCH_WIDTH)
    expect(row?.className).toContain('hidden')
  })

  it('establishes the container the queries resolve against', async () => {
    setLocale('sr')
    await renderTable([order])

    // Without `@container` every `@min-[…]` silently never matches and the app shows cards
    // forever, at any width, with nothing in the console to say so.
    const link = screen.getAllByRole('link')[0]
    const box = link?.closest('.\\@container')
    expect(box).not.toBeNull()
    expect(box?.className).toContain(`@min-[${SWITCH_WIDTH}px]:overflow-x-auto`)
    // The scrolling wrapper inside it must claim the same width, or the row gets squashed.
    expect(box?.querySelector(`[class*="min-w-[${SWITCH_WIDTH}px]"]`)).not.toBeNull()
  })

  it('carries the draft marker instead of a status when the intake is unfinished', async () => {
    setLocale('sr')
    await renderTable([{ ...order, signedAt: null, draftStep: 3 }])

    expect(screen.queryAllByText(/PRIMLJENO/i)).toHaveLength(0)
  })
})

describe('IntakeOrdersTable — discarding an unfinished intake from the list', () => {
  it('offers the bin on a draft and asks the list, not itself, who may', async () => {
    setLocale('sr')
    const seen: string[] = []
    await renderTable([{ ...order, signedAt: null, draftStep: 2 }], (item) => ({
      icon: Trash2,
      label: 'Odbaci',
      onSelect: () => seen.push(item.id),
    }))

    const bin = screen.getByRole('button', { name: 'Odbaci' })
    await userEvent.click(bin)

    // The row does NOT delete: it hands the order up, and the page owns the confirm dialog and
    // the mutation — the same division the claims list uses.
    expect(seen).toEqual([order.id])
  })

  it('shows no bin where the reader may not discard', async () => {
    setLocale('sr')
    // ⚙ this is the whole guard: the page hands back no action for a row this reader may not
    // touch, and the server refuses it again anyway.
    await renderTable([order], () => null)

    expect(screen.queryByRole('button', { name: 'Odbaci' })).not.toBeInTheDocument()
  })
})

describe('IntakeOrdersTable — an archived order is a place, not a state', () => {
  it('draws whatever action the page hands back, including the one that brings an order back', async () => {
    setLocale('sr')
    const picked: string[] = []
    await renderTable([{ ...order, archivedAt: '2026-08-22T10:00:00.000Z' }], (item) => ({
      icon: ArchiveRestore,
      label: 'Vrati na listu',
      onSelect: () => picked.push(item.id),
    }))

    await userEvent.click(screen.getByRole('button', { name: 'Vrati na listu' }))

    expect(picked).toEqual([order.id])
  })
})

describe('the empty result and the archive', () => {
  it('points at the archive when a search finds nothing in the working list', () => {
    render(<IntakeOrdersTable items={[]} rowAction={() => null} suggestArchived />)

    // Archived orders are filtered OUT of every other view, so an empty result is exactly the
    // moment the reader has no way of knowing the order still exists.
    expect(screen.getByText(m.intake_list_empty_try_archived())).toBeInTheDocument()
  })

  it('says nothing of the sort inside the archive itself', () => {
    render(<IntakeOrdersTable items={[]} rowAction={() => null} />)

    expect(screen.queryByText(m.intake_list_empty_try_archived())).toBeNull()
  })
})
