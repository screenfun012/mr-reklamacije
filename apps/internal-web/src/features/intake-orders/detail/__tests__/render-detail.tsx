import { setLocale } from '@mr/i18n'
import {
  IntakeArrivalMode,
  IntakeOrderDetailSchema,
  IntakeOrderStatus,
  IntakeVehicleType,
  type IntakeOrderDetail,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

const SIGNED_ORDER = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'RN-0950/26',
  status: IntakeOrderStatus.Received,
  receivedAt: '2026-07-27T18:42:00.000Z',
  technicianId: '22222222-2222-4222-8222-222222222222',
  technicianName: 'Miloš Jovanović',
  vehicleType: IntakeVehicleType.Car,
  plate: 'BG-950-AA',
  vehicle: 'Opel Astra 1.6 CDTI',
  vin: 'W0L0AHL0865012345',
  mileage: 184_500,
  arrivalMode: IntakeArrivalMode.Driven,
  ownerName: 'Brzi kurir doo',
  ownerAddress: 'Vojvode Stepe 12, Beograd',
  ownerPhone: '+381 61 234 5678',
  ownerRemarks: null,
  fuelLevel: 3,
  checklist: {
    rezervna: true,
    dizalica: true,
    komplet: true,
    saobracajna: true,
    vozacka: null,
    prvaPomoc: true,
    prsluk: true,
    lanci: false,
  },
  equipmentNote: null,
  damages: [],
  services: [],
  materials: [],
  draftStep: null,
  technicianSignature: 'M 0 0 L 10 10',
  ownerSignature: 'M 0 0 L 20 20',
  signedAt: '2026-07-27T19:10:00.000Z',
  amendedAt: null,
  amendedByName: null,
  deletedAt: null,
  photosPending: 0,
  photos: [],
  createdAt: '2026-07-27T18:42:00.000Z',
  updatedAt: '2026-07-27T19:10:00.000Z',
}

/**
 * Parsed through the wire schema rather than typed against it: `typecheck` excludes test
 * files, so a hand-written literal rots silently when the wire changes. Parsing makes the
 * wire change fail here instead of in the browser.
 */
export function intakeOrderDetailFixture(
  overrides: Partial<IntakeOrderDetail> = {},
): IntakeOrderDetail {
  return IntakeOrderDetailSchema.parse({ ...SIGNED_ORDER, ...overrides })
}

/** An unsigned draft: no signatures, a step to resume from, and nothing to advance. */
export function intakeDraftFixture(overrides: Partial<IntakeOrderDetail> = {}): IntakeOrderDetail {
  return intakeOrderDetailFixture({
    technicianSignature: null,
    ownerSignature: null,
    signedAt: null,
    draftStep: 3,
    ...overrides,
  })
}

/**
 * The detail's components carry `<Link>`s and React Query mutations, so neither renders
 * bare. Routes registered here are the ones those links point at.
 */
export async function renderDetailUi(ui: ReactElement): Promise<void> {
  setLocale('sr', { reload: false })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  })
  const children = (['/prijem', '/prijem/novi', '/prijem/$id'] as const).map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  render(<RouterProvider router={router as never} />)
}
