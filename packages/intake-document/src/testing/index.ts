import {
  IntakeArrivalMode,
  IntakeChecklistItemListItemSchema,
  IntakeOrderDetailSchema,
  IntakeOrderPhotoSchema,
  IntakeOrderStatus,
  IntakeOwnerType,
  IntakeVehicleType,
  type IntakeChecklistItemListItem,
  type IntakeOrderDetail,
  type IntakeOrderPhoto,
} from '@mr/shared'

/**
 * Fixtures for the intake document, shared by this package's tests and by internal-web's.
 *
 * They live behind the `@mr/intake-document/testing` entry point rather than the main one, so
 * nothing that ships to a browser can reach them by accident — and they live in the PACKAGE rather
 * than in the app because both sides assert against the same paper. Two fixture sets would let a
 * change look right on the screen's tests and wrong on the document's.
 */
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
  ownerType: IntakeOwnerType.Person,
  ownerIdNumber: null,
  ownerEmail: null,
  ownerAddress: 'Vojvode Stepe 12, Beograd',
  ownerPhone: '+381 61 234 5678',
  contactPhone: null,
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
  extraChecklist: [],
  equipmentNote: null,
  damages: [],
  extraDamages: [],
  services: [],
  materials: [],
  draftStep: null,
  technicianSignature: 'M 0 0 L 10 10',
  ownerSignature: 'M 0 0 L 20 20',
  signedAt: '2026-07-27T19:10:00.000Z',
  documentReady: true,
  documentEmailedAt: null,
  handoverTechnicianSignature: null,
  handoverOwnerSignature: null,
  handoverSignedAt: null,
  handoverDocumentReady: false,
  handoverDocumentEmailedAt: null,
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

/** One photo on the server, optionally bound to a damage marker. */
export function intakePhotoFixture(overrides: Partial<IntakeOrderPhoto> = {}): IntakeOrderPhoto {
  return IntakeOrderPhotoSchema.parse({
    id: '44444444-4444-4444-8444-444444444444',
    fileName: 'IMG_01.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 120_000,
    width: 2048,
    height: 1536,
    thumbnailPath: null,
    caption: null,
    damageId: null,
    uploadedAt: '2026-07-27T19:00:00.000Z',
    ...overrides,
  })
}

/**
 * The shop's checklist catalog as the seed leaves it — same codes, names and order as
 * `packages/db/src/seed/intake-catalogs.ts`, because that is what production reads. `lanci` is
 * DEACTIVATED here on purpose: the display path has to keep naming it (plan D3), and a catalog where
 * every row is live could never show that.
 */
const CHECKLIST_CATALOG = [
  { code: 'rezervna', nameSr: 'Rezervna guma', nameEn: 'Spare tyre', sortOrder: 10 },
  { code: 'dizalica', nameSr: 'Dizalica', nameEn: 'Jack', sortOrder: 20 },
  { code: 'komplet', nameSr: 'Komplet dizalice', nameEn: 'Jack kit', sortOrder: 30 },
  {
    code: 'saobracajna',
    nameSr: 'Saobraćajna dozvola',
    nameEn: 'Vehicle registration',
    sortOrder: 40,
  },
  { code: 'vozacka', nameSr: 'Vozačka dozvola', nameEn: "Driver's licence", sortOrder: 50 },
  { code: 'prvaPomoc', nameSr: 'Prva pomoć', nameEn: 'First-aid kit', sortOrder: 60 },
  { code: 'prsluk', nameSr: 'Prsluk i trougao', nameEn: 'Hi-vis vest and triangle', sortOrder: 70 },
  {
    code: 'lanci',
    nameSr: 'Lanci / alat',
    nameEn: 'Chains / tools',
    sortOrder: 80,
    isActive: false,
  },
]

/** Parsed through the wire schema, for the same reason the order fixture is. */
export function intakeChecklistCatalogFixture(): IntakeChecklistItemListItem[] {
  return CHECKLIST_CATALOG.map((item, index) =>
    IntakeChecklistItemListItemSchema.parse({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      isActive: true,
      ...item,
    }),
  )
}

/** An unsigned draft: no signatures, a step to resume from, and nothing to advance. */
export function intakeDraftFixture(overrides: Partial<IntakeOrderDetail> = {}): IntakeOrderDetail {
  return intakeOrderDetailFixture({
    technicianSignature: null,
    ownerSignature: null,
    signedAt: null,
    documentReady: false,
    documentEmailedAt: null,
    draftStep: 3,
    ...overrides,
  })
}
