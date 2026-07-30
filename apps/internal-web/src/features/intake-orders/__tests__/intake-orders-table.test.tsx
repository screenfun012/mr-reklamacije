import { setLocale } from '@mr/i18n'
import { IntakeOrderStatus, IntakeVehicleType, type IntakeOrderListItem } from '@mr/shared'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeOrdersTable } from '../intake-orders-table.js'

const order: IntakeOrderListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'RN-0950/26',
  status: IntakeOrderStatus.Received,
  receivedAt: '2026-07-27T18:42:00.000Z',
  vehicleType: IntakeVehicleType.Car,
  plate: 'BG-950-AA',
  vehicle: 'Opel Astra',
  ownerName: 'Brzi kurir doo',
  technicianName: 'Nikola Admin',
  damageCount: 1,
  photoCount: 3,
  signedAt: '2026-07-27T19:10:00.000Z',
  draftStep: null,
  amendedAt: null,
  photosPending: 0,
}

async function renderTable(items: readonly IntakeOrderListItem[]): Promise<void> {
  const rootRoute = createRootRoute({ component: () => <IntakeOrdersTable items={items} /> })
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

/** The width both layouts must agree on: see the table's own arithmetic (924 + 78 + 36). */
const SWITCH_WIDTH = 1038

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
