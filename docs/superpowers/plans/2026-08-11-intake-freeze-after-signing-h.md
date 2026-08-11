# H — potpis zamrzava zapis: plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Potpis prijema zatvara zapis — posle njega se menjaju samo usluge, materijal i novi dopisani broj za kontakt, a ceo režim izmene (V-6-2) izlazi iz koda.

**Architecture:** Ovo je pretežno **brisanje**. `FREE_AFTER_SIGNING = ['services', 'materials']` već postoji u servisu kao beli spisak; H skida mašineriju žiga oko njega (`CONDITION_FIELDS`, `CONTACT_FIELDS`, `classifyPostSigningPatch`, `withoutUnchanged`, dozvolu `intake_orders.amend`, kolone `amended_at`/`amended_by`, ceo režim izmene na ekranu) i tom spisku dodaje jedno novo polje, `contactPhone`. Jedina straža koja se DODAJE je na fotografijama: zakašnjela isporuka se prima samo do `photos_expected`.

**Tech Stack:** Hono + Drizzle (PostgreSQL) · TanStack Start (React 19) · Zod · Vitest (unit + integracija na pravom Postgresu) · Paraglide (sr/en)

## Global Constraints

- **Spec je izvor istine:** `docs/superpowers/specs/2026-08-11-intake-freeze-after-signing-h-design.md`. Odluke se ne re-otvaraju u kodu.
- **Grana:** `feat/vehicle-intake`, osnova `ec352a3`. Nije na `main`, nije u produkciji.
- **Pun gejt pre SVAKOG komita, i svaki zadatak završava komitom:**
  `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`
- ⚠⚠ **RED ZADATAKA JE OBAVEZAN I NIJE PROIZVOLJAN: ekran (2) ide PRE servera (3).** Brisanje niske `intake_orders.amend` iz unije dozvola obara **svako** njeno čitanje na tipu, a menjanje arnosti `repo.update` obara svaki poziv sa tri argumenta — pa bi server-prvi ostavio `apps/internal-web` bez `typecheck`-a i komit ne bi mogao da bude gate-green. Ekran-prvi briše samo **čitaoce**, što je zeleno samo po sebi, i onda server nema kome da pokvari. **Ne preuređivati zadatke 2 i 3.**
- **`--concurrency=4` je obavezan** ako Nikolin `pnpm dev:all` radi. **Nikad ne pokretati ni gasiti razvojne servere.**
- **Nikad dva gejta istovremeno** (`@mr/auth` padne bez razloga).
- **Migracije:** `drizzle-kit` ih generiše, nikad se ne pišu rukom. Zadaci 1 i 6 **STAJU i traže Nikolino izričito odobrenje** pre primene.
- **Bez `any`**, bez `!`, bez `enum`, bez tačka-zapeta, jednostruki navodnici, imenovani izvozi. Tipizovane domenske greške (`ValidationError`, `ForbiddenError`, `NotFoundError`), nikad go `Error`.
- **Jedno odbijanje = jedan status:** svako odbijanje zbog zamrzavanja je `ValidationError` (422). `ForbiddenError` (403) ostaje samo za nedostatak prava.
- **Stil testova u ovom repou:** `await expect(...).rejects.toBeInstanceOf(ValidationError)` — ne `toThrow`.
- **Svaki natpis ide u `sr.json` I `en.json`** (CI proverava parnost), pa `pnpm --filter @mr/i18n run compile` — bez toga ekran mirno prikazuje stari tekst.
- **Testovi koji dokazuju obrisano ponašanje se BRIŠU, ne prepravljaju.** Test imenovan po funkciji koje nema je gori od nepostojećeg testa.
- **NE dirati:** `repo.softDelete`, `restore`, filter „Uklonjeni", `IntakeRemovedBar`, straža `deletedAt`, natpisi `intake_detail_removed_*`. Prijavljeni su u §7 speca i čekaju Nikolinu odvojenu reč.
- **Pomoćnici u integracionom testu VEĆ POSTOJE** — koristiti njih, ne pisati nove: `createInput(overrides)` · `floorActor(name?)` · `officeActor(name?)` · `signedOrder(actor, overrides?) → id` · `signedOrderExpecting(actor, photosExpected) → id` · `photoInput()` · `transitionsOf(orderId)` · `actorContext(userId)` · `uniqueNumber(label)`. `OFFICE_PERMISSIONS = [...OPERATOR_PERMISSIONS]`, pa brisanje dozvole iz `@mr/shared` automatski menja i test.

---

## Struktura fajlova

**Menja se:**

| Fajl | Odgovornost posle H |
|---|---|
| `packages/db/src/schema/intake-orders.ts` | + `contact_phone`, pa (zadatak 6) − `amended_at`/`amended_by` |
| `packages/shared/src/permissions.ts` | − `intake_orders.amend` iz `PERMISSIONS` i `OPERATOR_PERMISSIONS` |
| `packages/shared/src/schemas/intake-order.wire.schema.ts` | + `contactPhone` (ulaz + dva modela za čitanje), − `amendedAt`/`amendedByName` |
| `packages/shared/src/index.ts` | − izvoz `sameIntakeChecklist`/`sameIntakeDamages` |
| `apps/api/src/modules/intake-orders/intake-orders.service.ts` | jedna straža zamrzavanja umesto mašinerije žiga |
| `apps/api/src/modules/intake-orders/intake-orders.repository.ts` | `update` bez `amendedBy`, + `contactPhone`, − spoj `amender`, − `shiftPhotosExpected` |
| `apps/internal-web/src/routes/_shell/prijem/$id.tsx` | orkestrator bez režima izmene |
| `apps/internal-web/src/features/intake-orders/detail/*` | detalj samo za čitanje + polje za kontakt |
| `apps/internal-web/src/features/intake-orders/print/*` | list bez oznake izmene |
| `apps/internal-web/src/features/intake-orders/intake-orders-table.tsx` | red bez markera izmene |
| `packages/i18n/src/messages/{sr,en}.json` | − ~30 natpisa, + 8 |
| `docs/25-vehicle-service-intake-design.md`, `CLAUDE.md` | pravilo zapisano |

**Briše se u celini:**

- `packages/shared/src/utils/intake-condition-equal.ts` (+ njegov test)
- `apps/internal-web/src/features/intake-orders/detail/intake-amend-bar.tsx`
- `apps/internal-web/src/features/intake-orders/detail/use-intake-amend.ts`
- `apps/internal-web/src/features/intake-orders/detail/__tests__/use-intake-amend.test.ts`

**Novo:**

- `apps/internal-web/src/features/intake-orders/detail/card-contact-phone.tsx`
- `apps/internal-web/src/features/intake-orders/detail/__tests__/card-contact-phone.test.tsx`

---

## Zadatak 1: migracija dodaje `contact_phone` (H-1)

**Files:**

- Modify: `packages/db/src/schema/intake-orders.ts` (odmah posle `ownerPhone`, linija 62)
- Create: `packages/db/migrations/0038_*.sql` + red u `meta/_journal.json` (generiše `drizzle-kit`)

**Interfaces:**

- Produces: kolona `intake_orders.contact_phone text` (bez `NOT NULL`), u TS-u `contactPhone: string | null`. Zadaci 4 i 5 je čitaju.

- [ ] **Korak 1: dodaj kolonu u šemu**

U `packages/db/src/schema/intake-orders.ts`, odmah posle `ownerPhone: text('owner_phone').notNull(),`:

```ts
    /**
     * A second number the shop may write down AFTER signing, when the signed one turns out to be
     * wrong. `owner_phone` is evidence and is never overwritten (docs/25 §5): the owner walks out
     * holding a printed sheet, so the number on it must keep matching the record. This is the
     * shop's working note — never printed, internal only, and only ever set on a signed order.
     */
    contactPhone: text('contact_phone'),
```

- [ ] **Korak 2: generiši migraciju**

Run: `pnpm --filter @mr/db run db:generate`
Expected: nov fajl `packages/db/migrations/0038_<ime>.sql`, nov red `idx: 38` u `meta/_journal.json`.

- [ ] **Korak 3: pročitaj SQL i potvrdi da je SAMO dodavanje kolone**

Run: `cat packages/db/migrations/0038_*.sql`
Expected — tačno jedan iskaz, ništa više:

```sql
ALTER TABLE "intake_orders" ADD COLUMN "contact_phone" text;
```

⚠ Ako fajl sadrži bilo šta drugo (`DROP`, `ALTER … TYPE`, drugu tabelu) — **STANI**, ne primenjuj, prijavi šta je generisano. Migracija koja nije napustila mašinu se prepravlja, ne nadograđuje.

- [ ] **Korak 4: STANI i traži Nikolino odobrenje**

Pokaži mu SQL iz koraka 3: aditivna je, nijedan postojeći red se ne dira, `NULL` znači „broj nije dopisan". **Ne primenjuj bez njegove reči.**

- [ ] **Korak 5: primeni na razvojnu bazu**

Run: `pnpm --filter @mr/db run db:migrate`
Expected: `0038` primenjena bez greške.

- [ ] **Korak 6: dokaži lanac od nule**

Run: `pnpm test:integration`
Expected: zeleno. Globalna priprema integracije radi migraciju od nule na `mr_reklamacije_test`, pa zeleno `test:integration` **je** dokaz da lanac 0000..0038 prolazi na praznoj bazi.

- [ ] **Korak 7: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages/db/src/schema/intake-orders.ts packages/db/migrations
git commit -m "feat(db): the shop gets a second phone number to write down, beside the signed one"
```

---

## Zadatak 2: internal-web — režim izmene izlazi sa ekrana (H-3, ide PRVI)

**Files:**

- Modify: `apps/internal-web/src/routes/_shell/prijem/$id.tsx`
- Modify: `.../detail/intake-detail-header.tsx:33,40-41,69-71,163-168,194-204,212-213,220-232`
- Modify: `.../detail/tab-overview.tsx:17,117,121,132,163,194-220,243-251,284-286`
- Modify: `.../detail/card-condition.tsx`, `.../detail/card-damages.tsx`, `.../detail/tab-photos.tsx`, `.../detail/intake-detail-tabs.tsx:61,87`, `.../detail/history-labels.ts:19-22`
- Modify: `.../intake-orders-table.tsx:116-120,165,196`
- Modify: `.../print/intake-print-data.ts:74,146-151`, `.../print/intake-print-sheet.tsx:138-144`
- Delete: `.../detail/intake-amend-bar.tsx`, `.../detail/use-intake-amend.ts`, `.../detail/__tests__/use-intake-amend.test.ts`
- Test: `.../detail/__tests__/intake-detail-header.test.tsx`, `tab-photos.test.tsx`, `tab-overview.test.tsx`, `history-labels.test.ts`, `.../__tests__/intake-orders-table.test.tsx`, `.../print/__tests__/intake-print-{data,sheet}.test.{ts,tsx}`

⚠⚠ **OVAJ ZADATAK IDE PRVI, PRE SERVERA, I TO JE JEDINI RED U KOM SVAKI KOMIT MOŽE DA IMA ZELEN GEJT.** Ovde se brišu samo **čitaoci** — server, žica i dozvola `intake_orders.amend` ostaju netaknuti, pa ništa ne puca. Da je server išao prvi, `apps/internal-web` ne bi prolazio `typecheck` dok se ekran ne očisti (brisanje niske iz unije dozvola obara svako njeno čitanje **na tipu**), pa komit zadatka 3 ne bi mogao da bude gate-green.

⚠ Zato: **ništa u ovom zadatku ne dira `packages/shared` ni `apps/api`.** Polje `amendedAt` i dalje postoji na žici i **mora da ostane** u fiksturi `render-detail.tsx` — ono je `nullable()`, dakle obavezno, i briše se u zadatku 3 zajedno sa šemom.

**Interfaces:**

- Consumes: ništa. Zadatak 2 je prvi.
- Produces: `IntakeDetailHeader` bez `canAmend`/`amendActive`/`onStartAmend`/`canDelete` · `TabOverview`/`CardCondition`/`CardDamages` bez propa `amend`, a `TabOverview` **dobija** `canUpdate: boolean` · `TabPhotos` bez `canAddPhotos`/`isOrderTechnician` · `IntakeDetailTabs` bez `locked`. Zadatak 5 se naslanja na `canUpdate`.

- [ ] **Korak 1: napiši padajuće testove**

⚠ `renderDetailUi` je **async** i vraća `RenderResult`; fiksture su `intakeOrderDetailFixture(overrides)` (potpisan nalog), `intakeDraftFixture(overrides)` (nacrt), `emptyQueueStub()`, `intakePhotoFixture()` — sve iz `render-detail.tsx`. Prati potpise propova iz postojećih testova u istim fajlovima.

U `.../detail/__tests__/intake-detail-header.test.tsx`:

```tsx
it('offers no edit and no removal on a signed order', async () => {
  await renderDetailUi(
    <IntakeDetailHeader
      order={intakeOrderDetailFixture()}
      canAdvance
      canChangeStatus
      onPrint={vi.fn()}
    />,
  )

  expect(screen.queryByRole('button', { name: 'Ispravi zatečeno stanje' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ukloni nalog' })).not.toBeInTheDocument()
  // Nothing can set the stamp any more, so the badge must not exist either.
  expect(screen.queryByText(/Menjano posle potpisa/)).not.toBeInTheDocument()
})
```

U `.../detail/__tests__/tab-photos.test.tsx`:

```tsx
it('offers no + cell and no delete on a signed order', async () => {
  await renderDetailUi(
    <TabPhotos
      order={intakeOrderDetailFixture({ photos: [intakePhotoFixture()] })}
      queue={emptyQueueStub()}
    />,
  )

  expect(screen.queryByRole('button', { name: 'Dodaj fotografiju' })).not.toBeInTheDocument()
})
```

Natpisi su prepisani iz `sr.json`: `intake_amend_start` = „Ispravi zatečeno stanje", `intake_detail_remove` = „Ukloni nalog", `intake_photo_add` = „Dodaj fotografiju", `intake_detail_amended_badge` = „⚠ Menjano posle potpisa".

- [ ] **Korak 2: pokreni i potvrdi da PADA**

Run: `pnpm --filter internal-web test -- intake-detail-header tab-photos --run`
Expected: FAIL — oba dugmeta i `+` ćelija danas postoje.

- [ ] **Korak 3: obriši tri fajla**

```bash
rm apps/internal-web/src/features/intake-orders/detail/intake-amend-bar.tsx
rm apps/internal-web/src/features/intake-orders/detail/use-intake-amend.ts
rm apps/internal-web/src/features/intake-orders/detail/__tests__/use-intake-amend.test.ts
```

- [ ] **Korak 4: pusti prevodilac da nabroji ostatak, pa čisti po redu**

Run: `pnpm --filter internal-web typecheck`

- **`$id.tsx`** — obriši uvoze `IntakeAmendBar` i `useIntakeAmend`, `const amend = useIntakeAmend(order)`, `startAmend`, `canAmend`, `canAddPhotos`, blok `{amend.active ? <IntakeAmendBar … /> : null}` (:123-129), `ConfirmDialog` za izmenu (:193-206), propove `canAmend`/`amendActive`/`onStartAmend`/`canDelete` na zaglavlju, `locked` na traci tabova, `amend={…}` na `TabOverview`, `canAddPhotos`/`isOrderTechnician` na `TabPhotos`. Uslov na `IntakeStatusBar` (:153) postaje `isLive && permissions.includes('intake_orders.change_status')`. **`useIntakePhotoQueue` i prop `queue` OSTAJU** — nose ćelije u letu iz istog mounta.
  Dodaj prop koji zadatak 5 traži: `<TabOverview order={order} canUpdate={permissions.includes('intake_orders.update')} />`.
- **`intake-detail-header.tsx`** — obriši propove `canAmend`/`amendActive`/`onStartAmend`/`canDelete`, bedž (:163-168), dugme „Ispravi" (:194-204), `disabled`/`title` vezane za `amendActive` (:212-213), **i celo dugme „Ukloni" (:220-232) sa njegovim `ConfirmDialog`-om** — prikazivalo se samo uz `isLive`, a potpisan nalog se po ㉗ ne briše, pa je mrtvo.
- **`tab-overview.tsx`** — obriši prop `amend` i sve njegove grane (telefon i merač goriva vraćaju se na čisto čitanje), napomenu uz potpise (:243-251) i `controlCell` (:163).
- **`card-condition.tsx`, `card-damages.tsx`** — obriši prop `amend` i grane; ostaje samo čitanje.
- **`tab-photos.tsx`** — obriši propove `canAddPhotos`/`isOrderTechnician`, `+` ćeliju (:137-146), oba `ConfirmDialog`-a (:155-188), `remove()`, `picker`, i stanja `confirmAdd`/`deleting`/`removing`, plus `onDelete` na svetlosniku (:195). Ostaju mreža, natpisi i pregled.
- **`intake-detail-tabs.tsx`** — obriši prop `locked` i `title` (:87).
- **`history-labels.ts`** — obriši `amend_after_signing`, `amend_contact_after_signing`, `amend_photo_added`, `amend_photo_removed`; dodaj `contact_added: m.intake_history_contact_added,` (natpis dolazi u zadatku 5 — do tada `typecheck` pada, pa ovaj red dodaj u zadatku 5, a u ovom samo obriši četiri).
- **`intake-orders-table.tsx`** — obriši `amendedMarker` (:116-120) i oba mesta gde se prikazuje (:165, :196).
- **`intake-print-data.ts` / `intake-print-sheet.tsx`** — obriši polje `amended` iz modela (:74), njegovo punjenje (:146-151) i blok koji ga štampa (:138-144).
⚠ **`.../detail/__tests__/render-detail.tsx` se u ovom zadatku NE DIRA.** `amendedAt`/`amendedByName` su još na žici i još obavezni (`nullable()`), pa bi ih brisanje iz fiksture oborilo `IntakeOrderDetailSchema.parse`. Idu u zadatku 3, sa šemom.

- [ ] **Korak 5: pokreni testove i potvrdi da PROLAZE**

Run: `pnpm --filter internal-web test -- intake --run`
Expected: PASS. Testove koji dokazuju žig, traku izmene, oznaku na papiru ili marker u listi **obriši u celini** — ne prepravljaj ih u „ne postoji", to pokrivaju testovi iz koraka 1.

- [ ] **Korak 6: mutacije**

| Mutacija | Mora da obori |
|---|---|
| vrati dugme „Ukloni" u zaglavlje (bez uslova) | „offers no edit and no removal" |
| vrati `+` ćeliju u `tab-photos` (bez uslova) | „offers no + cell" |

- [ ] **Korak 7: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web
git commit -m "refactor(intake): the signed order stops offering an edit it is no longer allowed to make"
```

---
## Zadatak 3: server — zamrzavanje, i mašinerija žiga izlazi (H-2)

⚠ **Ovaj zadatak je veliki i NE MOŽE da se podeli.** Brisanje niske `intake_orders.amend` iz unije dozvola u `@mr/shared` obara **svako** njeno čitanje na tipu (`actor.permissions.includes('intake_orders.amend')` prestaje da se tipizuje), a menjanje potpisa `repo.update` obara svaki poziv sa tri argumenta. Polovično stanje ne prolazi `typecheck`, pa ne može da se komituje. Sve što zavisi od tih dva potpisa ide zajedno.

**Files:**

- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts:57-104` (spiskovi + `updateTransition`), `:332-383` (`update`), `:413-480` (dve privatne metode odlaze), `:600-618` (`delete`), `:699-711` + `:742-745` (`uploadPhoto`), `:777-794` (`deletePhoto`)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts:95-96,164-165,175,209-210,235,346,372,439-473,538`
- Modify: `packages/shared/src/permissions.ts:67,198`
- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts:190,244-245`
- Modify: `packages/shared/src/index.ts:28`
- Delete: `packages/shared/src/utils/intake-condition-equal.ts` i njegov test
- Modify: `docs/25-vehicle-service-intake-design.md` (§3.0.1, §5), `CLAUDE.md` (§2)
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

**Interfaces:**

- Consumes: ništa iz zadatka 1 (kolona postoji, još se ne čita).
- Produces: `IntakeOrdersRepository.update(id, patch)` — **dva** argumenta · niska `intake_orders.amend` više ne postoji nigde · `FREE_AFTER_SIGNING = ['services', 'materials', 'contactPhone']` · `updateTransition(signedAt, patch)` vraća `'contact_added' | 'spec_updated' | null`. Zadatak 4 se naslanja na poslednja dva.

- [ ] **Korak 1: napiši padajuće testove (zamrzavanje)**

U `intake-orders.integration.test.ts`, nov `describe` blok. `ALL_PERMISSIONS` dodaj u postojeći uvoz iz `@mr/shared` na vrhu fajla:

```ts
  describe('the signature freezes the record', () => {
    it('refuses every frozen field on a signed order, office and floor alike', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrder(serviser)

      const frozen = [
        { plate: 'BG-999-XX' },
        { vehicleType: IntakeVehicleType.Kombi },
        { ownerName: 'Neko Drugi' },
        { ownerPhone: '+381 60 000 0000' },
        { ownerRemarks: 'dopisano posle' },
        { fuelLevel: 1 },
        { checklist: { ...createInput().checklist, rezervna: false } },
        { damages: [] },
        { equipmentNote: 'dopisano posle' },
      ] as const

      // An admin holds ALL_PERMISSIONS, so he is the one actor who could still have a way in.
      // The freeze has no permission branch at all — this pins that it never grows one (㉕).
      const admin: IntakeOrdersActor = {
        id: await createUser('Admin'),
        permissions: [...ALL_PERMISSIONS],
      }

      for (const patch of frozen) {
        for (const actor of [office, serviser, admin]) {
          await expect(
            service.update(id, patch, actor, actorContext(actor.id)),
          ).rejects.toBeInstanceOf(ValidationError)
        }
      }
    })

    it('refuses a frozen field even when the value equals what is stored', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())
      const before = await service.findById(id, office)

      // Refused on the field's NAME. Pruning a key because it happens to match would make
      // "send it again with the same value" a way past the freeze.
      await expect(
        service.update(id, { ownerName: before.ownerName }, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('still accepts services and materials, lets one be removed, and says so in Istorija', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())

      const withParts = await service.update(
        id,
        { services: ['zamena ulja'], materials: ['filter', 'ulje 5W30'] },
        office,
        actorContext(office.id),
      )
      expect(withParts.materials).toEqual(['filter', 'ulje 5W30'])

      const withoutOne = await service.update(
        id,
        { materials: ['filter'] },
        office,
        actorContext(office.id),
      )
      expect(withoutOne.materials).toEqual(['filter'])
      expect(await transitionsOf(id)).toContain('spec_updated')
    })

    it('refuses to remove a signed order, and still discards a draft', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const signed = await signedOrder(serviser)

      await expect(
        service.delete(signed, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ValidationError)

      const draft = await service.create(createInput(), actorContext(serviser.id))
      await service.delete(draft.id, serviser, actorContext(serviser.id))
      await expect(service.findById(draft.id, office)).rejects.toBeInstanceOf(NotFoundError)
    })
  })
```

- [ ] **Korak 2: napiši padajuće testove (fotografije)**

U isti `describe`:

```ts
    it('accepts a late photo from the order own serviser, only up to photos_expected', async () => {
      const serviser = await floorActor()
      const id = await signedOrderExpecting(serviser, 1)

      const photo = await service.uploadPhoto(
        id,
        photoInput(),
        null,
        serviser,
        actorContext(serviser.id),
      )
      expect(photo.id).toBeDefined()

      // The record no longer admits anything is missing, so the door is shut.
      await expect(
        service.uploadPhoto(id, photoInput(), null, serviser, actorContext(serviser.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('refuses a photo on a signed order from anyone but its own serviser', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrderExpecting(serviser, 2)

      await expect(
        service.uploadPhoto(id, photoInput(), null, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('refuses removing a photo from a signed order, for everyone', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrderExpecting(serviser, 1)
      const photo = await service.uploadPhoto(
        id,
        photoInput(),
        null,
        serviser,
        actorContext(serviser.id),
      )

      for (const actor of [serviser, office]) {
        await expect(
          service.deletePhoto(id, photo.id, actor, actorContext(actor.id)),
        ).rejects.toBeInstanceOf(ValidationError)
      }
    })
```

- [ ] **Korak 3: pokreni testove i potvrdi da PADAJU**

Run: `pnpm --filter api test -- intake-orders.integration --run`
Expected: FAIL. Danas prolaze: izmena zamrznutog polja uz žig, meko brisanje potpisanog naloga, drugi upload preko kape, brisanje fotografije uz `amend`.

- [ ] **Korak 4: zameni tri spiska jednim**

U `intake-orders.service.ts` obriši `CONDITION_FIELDS` (:68-69), `CONTACT_FIELDS` (:71-77) i `type IntakeAmendmentKind` (:79), pa zameni komentar + spisak na :57-66:

```ts
/**
 * What may still be edited once the customer has signed — and it is the WHOLE list.
 *
 * The signature closes the record (Nikola, 2026-08-11): the owner walks out holding a printed
 * sheet, so anything that can still move on our side is a conflict with a document he signed —
 * and grounds for a complaint against his own evidence. Services and materials are the shop's
 * running record of work that happens AFTER the intake; `contactPhone` is a working note that
 * never overwrites the signed number (docs/25 §5).
 *
 * This replaced the amend mode, which allowed the correction and announced it with a permanent
 * stamp. Do not reintroduce a stamped edit path: the announcement WAS the divergence.
 */
const FREE_AFTER_SIGNING = ['services', 'materials', 'contactPhone'] as const
```

- [ ] **Korak 5: prepiši `updateTransition`**

Zameni celu funkciju (:81-104):

```ts
/**
 * A signed order allows exactly two changes, and each gets its own name in Istorija. A patch that
 * carries the contact number is named for it: services and materials move constantly and would
 * otherwise bury the one entry that says somebody wrote a second phone number on a signed order.
 *
 * Takes `signedAt` itself (not a pre-computed boolean) so a swapped argument at the call site is a
 * type error, and returns a closed union rather than `string | null` for the same reason.
 */
function updateTransition(
  signedAt: string | null,
  patch: IntakeOrderUpdateInput,
): 'contact_added' | 'spec_updated' | null {
  if (signedAt === null) {
    return null
  }
  if (patch.contactPhone !== undefined) {
    return 'contact_added'
  }
  return 'spec_updated'
}
```

- [ ] **Korak 6: jedna straža umesto dve privatne metode**

Obriši `classifyPostSigningPatch` (:413-451) i `withoutUnchanged` (:453-480) u celini; na njihovo mesto:

```ts
  /**
   * A signed order accepts only `FREE_AFTER_SIGNING`. Refused on the field's NAME, never on its
   * value: pruning a key because it happens to equal what is stored would make "send it again with
   * the same value" a way past the freeze. Enforced HERE and not only on the route — a serviser
   * holds `update`, and there is no second gate left to catch him.
   */
  private assertPostSigningPatchAllowed(patch: IntakeOrderUpdateInput): void {
    const free = new Set<string>(FREE_AFTER_SIGNING)
    const frozen = Object.keys(patch).filter((field) => !free.has(field))

    if (frozen.length > 0) {
      throw new ValidationError(
        `Signed intake order: ${frozen.join(', ')} cannot be changed after signing`,
      )
    }
  }
```

- [ ] **Korak 7: prepiši `update`**

Zameni od :338 (`const before`) do :368 (red sa `const transition`):

```ts
    const before = await this.loadVisible(id, actor)
    this.assertNotDeleted(before)
    this.assertDraftOwner(before, actor)

    // Asserted on the RAW patch, before zones are derived: a `vehicleType` patch pulls `damages`
    // in below, and the refusal must name what the caller actually sent.
    if (before.signedAt !== null) {
      this.assertPostSigningPatchAllowed(patch)
    }

    if (patch.orderNumber !== undefined) {
      await this.assertNumberFree(normalizeOrderNumberKey(patch.orderNumber), id)
    }

    const effective = this.withDerivedZones(patch, before)

    if (Object.keys(effective).length === 0) {
      // Nothing to write: no history row, no realtime signal.
      return before
    }

    const updated = await this.repo.update(id, effective)
    if (updated === null) {
      throw new NotFoundError('Intake order', id)
    }

    const transition = updateTransition(before.signedAt, effective)
```

- [ ] **Korak 8: potpisan nalog se ne briše**

U `delete` zameni :608-618:

```ts
    /**
     * The signature closes the record, and that includes whether it exists: a signed order is the
     * shop's half of a document the owner is holding. Only an unfinished draft can be discarded,
     * and that is a HARD delete — its number goes back into circulation.
     */
    if (before.signedAt !== null) {
      throw new ValidationError('A signed intake order cannot be removed')
    }

    if (before.technicianId !== actor.id && !actor.permissions.includes('intake_orders.delete')) {
      throw new ForbiddenError("Discarding another serviser's unfinished intake requires delete")
    }
    await this.repo.hardDelete(id)
```

⚠ **Ne dirati `repo.softDelete`, `restore`, ni stražu `deletedAt`** (§7 speca).

- [ ] **Korak 9: kapa na zakašnjelu isporuku fotografije**

U `uploadPhoto` zameni :707-711 (`isLateArrival`/`isAmendment` + kapija `amend`):

```ts
    /**
     * A late arrival is the tablet delivering what it already held at signing — not a change, which
     * is why `docs/25` §3.6 can promise "no network → the order saves, the photos go by themselves".
     *
     * ⚠ The old gate asked only WHO uploads, never how many, so the order's own serviser could hang
     * a photo of damage done in the shop onto a frozen record a week later. `photos_expected` was
     * written at signing as "arrived + outstanding, failures included", so `photosPending` is
     * exactly how many photos the record still admits are missing — and the door is that wide, no
     * wider.
     */
    if (order.signedAt !== null) {
      if (order.technicianId !== actor.id) {
        throw new ForbiddenError('A signed intake order accepts photos only from its own serviser')
      }
      if (order.photosPending <= 0) {
        throw new ValidationError('A signed intake order already holds every photo it expected')
      }
    }
```

pa obriši blok koji je pisao žig i pomerao očekivanje (:742-745):

```ts
    if (isAmendment) {
      await this.repo.update(id, {}, auditContext.actorUserId)
      await this.repo.shiftPhotosExpected(id, 1)
    }
```

i u zapisu u dnevnik zameni ternar `transition: isAmendment ? 'amend_photo_added' : 'photo_uploaded',` sa `transition: 'photo_uploaded',`.

- [ ] **Korak 10: brisanje fotografije posle potpisa — odbijeno svima**

U `deletePhoto` zameni :785-788 (kapija `amend`):

```ts
    /**
     * The customer signed for the condition these photos show, so removing one afterwards is
     * exactly the divergence the freeze exists to prevent. Refused for everyone — the office no
     * longer has a stamp to record it with, and a silent removal is worse than a refusal.
     */
    if (order.signedAt !== null) {
      throw new ValidationError('A signed intake order: photos cannot be removed')
    }
```

obriši blok (:791-794):

```ts
    if (isAmendment) {
      await this.repo.update(id, {}, auditContext.actorUserId)
      await this.repo.shiftPhotosExpected(id, -1)
    }
```

i zameni ternar `transition: isAmendment ? 'amend_photo_removed' : 'photo_removed',` sa `transition: 'photo_removed',`.

- [ ] **Korak 11: `shiftPhotosExpected` je ostao bez pozivaoca**

Run: `grep -rn "shiftPhotosExpected" apps packages`
Expected: samo definicija u `intake-orders.repository.ts:538`. **Obriši celu metodu.**

- [ ] **Korak 12: repozitorijum — `update` bez trećeg argumenta, i žig sa čitanja**

U `intake-orders.repository.ts`:

- potpis (:439-443) →

```ts
  async update(id: string, patch: IntakeOrderUpdateInput): Promise<IntakeOrderDetail | null> {
```

- ispod reda za `ownerPhone` (:461) dodaj:

```ts
    if (patch.contactPhone !== undefined) values['contactPhone'] = patch.contactPhone
```

- obriši blok žiga (:471-474):

```ts
    if (amendedBy !== null) {
      values['amendedAt'] = new Date()
      values['amendedBy'] = amendedBy
    }
```

- obriši sa čitanja: polja `amendedAt`/`amendedByName` iz tipa reda (:95-96) i iz oba mapiranja (:164-165, :372), `const amender = alias(users, 'amender')` (:175), izabrane kolone (:209-210, :346), i `leftJoin(amender, …)` (:235).

- [ ] **Korak 13: `@mr/shared` — dozvola, žica, uporedbe**

- `packages/shared/src/permissions.ts`: obriši `'intake_orders.amend',` sa :67 **i** :198.
- `packages/shared/src/schemas/intake-order.wire.schema.ts`: obriši `amendedAt` (:190) i `amendedAt`/`amendedByName` (:244-245).
- `packages/shared/src/index.ts`: obriši izvoz sa :28.

```bash
rm packages/shared/src/utils/intake-condition-equal.ts
ls packages/shared/src/utils/__tests__/ | grep intake-condition   # obriši i taj fajl ako postoji
```

⚠ I sada, kad šema više ne poznaje ta dva polja, obriši `amendedAt: null,` i `amendedByName: null,` iz `SIGNED_ORDER` u `apps/internal-web/src/features/intake-orders/detail/__tests__/render-detail.tsx`. `parse` ih ionako tiho odbacuje, pa ne pucaju — ali imenuju polje kojeg nema, a to je zamka za sledećeg čitaoca.

- [ ] **Korak 14: pokreni testove i potvrdi da PROLAZE**

Run: `pnpm --filter api test -- intake-orders.integration --run`
Expected: PASS svih sedam novih.

- [ ] **Korak 15: obriši testove koji dokazuju obrisano ponašanje**

Run: `grep -n "amend" apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

Za svaki `it(...)` koji dokazuje žig, kapiju `amend`, pomeranje `photos_expected` ili prelaze `amend_after_signing` / `amend_contact_after_signing` / `amend_photo_added` / `amend_photo_removed` — **obriši ceo `it` blok.** Ne prepravljaj ih u „odbija se": to već pokrivaju testovi iz koraka 1 i 2.

- [ ] **Korak 16: mutacije — dokaži da testovi stvarno drže**

Svaku mutaciju uvedi, pokreni `pnpm --filter api test -- intake-orders.integration --run`, pa **VRATI**:

| Mutacija | Mora da obori |
|---|---|
| u `assertPostSigningPatchAllowed`, `frozen.length > 0` → `false` | „refuses every frozen field" |
| u `update`, `before.signedAt !== null` → `false` | „refuses every frozen field" |
| u `delete`, `before.signedAt !== null` → `false` | „refuses to remove a signed order" |
| u `uploadPhoto`, `order.photosPending <= 0` → `false` | „only up to photos_expected" |
| u `uploadPhoto`, `order.technicianId !== actor.id` → `false` | „from anyone but its own serviser" |
| u `deletePhoto`, `order.signedAt !== null` → `false` | „refuses removing a photo" |

⚠ Ako bilo koja mutacija **ne obori ništa**, test ne pokriva liniju koju misliš da pokriva — popravi test, ne mutaciju.

- [ ] **Korak 17: zapiši pravilo u dokumentaciju**

U `docs/25-vehicle-service-intake-design.md` §3.0.1 i §5 zameni opis režima izmene tabelom dva zamrzavanja iz §1 speca. U `CLAUDE.md` §2 dodaj invarijantu:

```markdown
- **Prijem: potpis zamrzava zapis (2026-08-11, deo H).** Potpisi prijema zatvaraju sve što je radnik uneo; posle njih se menjaju samo `services`, `materials` i `contactPhone` (`FREE_AFTER_SIGNING` u `intake-orders.service.ts` je ceo spisak, i odbijanje ide na IME polja, ne na vrednost). Potpisan nalog se **ne briše**; fotografija se posle potpisa prima samo od nalogovog servisera i samo dok `photosPending > 0`, a ne briše se nikome. Razlog je vlasnikov odštampani papir: sve što se kod nas može pomeriti je neslaganje sa dokumentom koji je potpisao. **Režim izmene (V-6-2 — žig „menjano posle potpisa", dozvola `intake_orders.amend`, kolone `amended_at`/`amended_by`) je RETIRED — ne vraćati ga**; objava neslaganja je bila samo neslaganje. Drugo zamrzavanje, na primopredaji, sleće sa delom F.
```

- [ ] **Korak 18: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/api packages/shared apps/internal-web docs/25-vehicle-service-intake-design.md CLAUDE.md
git commit -m "feat(api): the signature closes the record, and the stamped edit path goes with it"
```

⚠ Gejt **mora** da bude zelen ovde. Ako `apps/internal-web` ne prolazi `typecheck` zbog `amendedAt` ili `intake_orders.amend`, **zadatak 2 nije završen do kraja** — vrati se na njega, ne ćuti grešku i ne komituj.

---
## Zadatak 4: server — dopisani broj za kontakt (H-2)

**Files:**

- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts` (ulazni model uz :60, oba modela za čitanje uz `ownerPhone`)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (straža „samo posle potpisa")
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

**Interfaces:**

- Consumes: `FREE_AFTER_SIGNING` (već sadrži `contactPhone`) i `updateTransition` (već vraća `contact_added`) iz zadatka 3 · kolona iz zadatka 1.
- Produces: `IntakeOrderUpdateInput.contactPhone?: string | null` · `IntakeOrderDetail.contactPhone: string | null` i `IntakeOrderListItem.contactPhone: string | null` na žici. Zadatak 5 ih čita.

- [ ] **Korak 1: napiši padajuće testove**

```ts
    it('writes a contact number beside the signed one, and never over it', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())
      const before = await service.findById(id, office)

      const updated = await service.update(
        id,
        { contactPhone: '+381 64 123 4567' },
        office,
        actorContext(office.id),
      )

      expect(updated.contactPhone).toBe('+381 64 123 4567')
      // The whole reason this field is allowed to exist: the signed number is untouched.
      expect(updated.ownerPhone).toBe(before.ownerPhone)
      expect(await transitionsOf(id)).toContain('contact_added')
    })

    it('clears the contact number when sent null', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())
      await service.update(id, { contactPhone: '+381 64 1' }, office, actorContext(office.id))

      const cleared = await service.update(
        id,
        { contactPhone: null },
        office,
        actorContext(office.id),
      )
      expect(cleared.contactPhone).toBeNull()
    })

    it('refuses a contact number on a DRAFT — there the real field is simply corrected', async () => {
      const serviser = await floorActor()
      const draft = await service.create(createInput(), actorContext(serviser.id))

      await expect(
        service.update(
          draft.id,
          { contactPhone: '+381 64 1' },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
```

- [ ] **Korak 2: pokreni i potvrdi da PADA**

Run: `pnpm --filter api test -- intake-orders.integration --run`
Expected: FAIL — `contactPhone` nije na ulaznom modelu, Zod ga odbaci, polja nema na odgovoru.

- [ ] **Korak 3: dodaj polje na ulazni model**

U `intake-order.wire.schema.ts`, u `Update` objekat uz `ownerPhone` (:60):

```ts
    /**
     * The shop's working note, not evidence — the signed `ownerPhone` is never overwritten
     * (docs/25 §5). Nullable so a number written by mistake can be taken back off the screen;
     * the service refuses it on a draft, where the real field is still editable.
     */
    contactPhone: z.string().trim().min(3).max(40).nullable().optional(),
```

i u **oba** modela za čitanje (detalj i red liste), uz `ownerPhone`:

```ts
  contactPhone: z.string().nullable(),
```

- [ ] **Korak 4: dopuni fiksturu detalja — inače pada SVAKI test detalja**

⚠ `nullable()` je **obavezno** polje, ne `optional()`. A fikstura u
`apps/internal-web/src/features/intake-orders/detail/__tests__/render-detail.tsx:28` ide kroz
`IntakeOrderDetailSchema.parse(...)` — bez novog polja parsiranje puca i **ceo paket testova detalja
i štampe pada**, iako proizvodni kod radi. Zato u `SIGNED_ORDER`, uz `ownerPhone`, dodaj:

```ts
  contactPhone: null,
```

Run: `pnpm --filter internal-web test -- intake --run`
Expected: prolazi kao pre. Ako pada na `IntakeOrderDetailSchema` — polje nije dodato u fiksturu.

⚠ Isto proveri i za fiksturu **reda liste**, ako je i ona parsirana kroz šemu:
Run: `grep -rn "IntakeOrderListItemSchema.parse" apps/internal-web/src`

- [ ] **Korak 5: odbij ga na nacrtu**

U `intake-orders.service.ts`, u `update`, odmah posle bloka `if (before.signedAt !== null) { this.assertPostSigningPatchAllowed(patch) }`:

```ts
    // The added number exists only because the signed one is frozen. On a draft there is nothing
    // to work around: the real field is still editable, and a second place to type the same thing
    // is a hole the screen would have to explain (docs/25 §3.0).
    if (before.signedAt === null && patch.contactPhone !== undefined) {
      throw new ValidationError(
        'contactPhone belongs to a signed order — correct ownerPhone instead',
      )
    }
```

- [ ] **Korak 6: pokreni i potvrdi da PROLAZI**

Run: `pnpm --filter api test -- intake-orders.integration --run`
Expected: PASS sva tri.

- [ ] **Korak 7: mutacije**

| Mutacija | Mora da obori |
|---|---|
| `before.signedAt === null && …` → `false` | „refuses a contact number on a DRAFT" |
| u `updateTransition`, `return 'contact_added'` → `return 'spec_updated'` | „writes a contact number beside the signed one" |
| u repozitorijumu obriši red `values['contactPhone'] = …` | „writes a contact number" i „clears the contact number" |

Svaku vrati posle merenja.

- [ ] **Korak 8: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/api packages/shared apps/internal-web/src/features/intake-orders/detail/__tests__/render-detail.tsx
git commit -m "feat(api): a second number can be written beside the signed one, never over it"
```

---
## Zadatak 5: internal-web — polje „Broj za kontakt" i čišćenje natpisa (H-3)

**Files:**

- Create: `.../detail/card-contact-phone.tsx`, `.../detail/__tests__/card-contact-phone.test.tsx`
- Modify: `.../detail/tab-overview.tsx` (montira karticu ispod telefona, prima `canUpdate`)
- Modify: `.../detail/history-labels.ts` (dodaje `contact_added`)
- Modify: `packages/i18n/src/messages/sr.json`, `packages/i18n/src/messages/en.json`

**Interfaces:**

- Consumes: `IntakeOrderDetail.contactPhone` (zadatak 4) · `updateIntakeOrder(id, { contactPhone })` iz `@mr/shared` · `canUpdate` prop koji `$id.tsx` prosleđuje od zadatka 2.
- Produces: `<IntakeContactPhone order={order} canUpdate={boolean} />`.

- [ ] **Korak 1: dodaj natpise u OBA jezika**

`sr.json`:

```json
  "intake_contact_phone_label": "Broj za kontakt (dopisan)",
  "intake_contact_phone_signed_hint": "Broj na potpisanom nalogu: {phone}",
  "intake_contact_phone_save": "Sačuvaj",
  "intake_contact_phone_clear": "Skloni",
  "intake_contact_phone_saved": "Broj za kontakt je zapisan.",
  "intake_contact_phone_placeholder": "npr. +381 64 123 4567",
  "intake_history_contact_added": "Dopisan broj za kontakt",
```

`en.json`:

```json
  "intake_contact_phone_label": "Contact number (added)",
  "intake_contact_phone_signed_hint": "Number on the signed order: {phone}",
  "intake_contact_phone_save": "Save",
  "intake_contact_phone_clear": "Remove",
  "intake_contact_phone_saved": "Contact number saved.",
  "intake_contact_phone_placeholder": "e.g. +381 64 123 4567",
  "intake_history_contact_added": "Contact number added",
```

⚠ Bez ICU množine — nijedan natpis ne sme da zavisi od broja.

- [ ] **Korak 2: prevedi ih**

Run: `pnpm --filter @mr/i18n run compile`
Expected: prolazi. Bez ovog koraka ekran mirno prikazuje stari tekst.

- [ ] **Korak 3: preveži Istoriju**

U `.../detail/history-labels.ts` dodaj u mapu:

```ts
  contact_added: m.intake_history_contact_added,
```

- [ ] **Korak 4: napiši padajući test**

`.../detail/__tests__/card-contact-phone.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeContactPhone } from '../card-contact-phone'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail'

describe('IntakeContactPhone', () => {
  it('keeps the signed number visible and labelled as the signed one', async () => {
    await renderDetailUi(
      <IntakeContactPhone
        order={intakeOrderDetailFixture({
          ownerPhone: '+381 11 111 111',
          contactPhone: '+381 64 222 222',
        })}
        canUpdate={false}
      />,
    )

    expect(screen.getByText('+381 64 222 222')).toBeInTheDocument()
    // The whole reason this field is allowed to exist: it must never look like a replacement.
    expect(screen.getByText(/\+381 11 111 111/)).toBeInTheDocument()
  })

  it('renders nothing at all on a draft', async () => {
    await renderDetailUi(
      <IntakeContactPhone order={intakeDraftFixture({ contactPhone: null })} canUpdate />,
    )

    // The card is the only thing rendered inside the router shell, so its own text is the probe.
    expect(screen.queryByText(/Broj za kontakt/)).not.toBeInTheDocument()
  })

  it('offers no input without update permission', async () => {
    await renderDetailUi(
      <IntakeContactPhone
        order={intakeOrderDetailFixture({ contactPhone: '+381 64 222 222' })}
        canUpdate={false}
      />,
    )

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
```

⚠ `renderDetailUi` montira komponentu unutar rutera, pa `container` nikad nije prazan — zato provera „na nacrtu nema ničega" ide preko **teksta same kartice**, ne preko `toBeEmptyDOMElement()`.

- [ ] **Korak 5: pokreni i potvrdi da PADA**

Run: `pnpm --filter internal-web test -- card-contact-phone --run`
Expected: FAIL — modul ne postoji.

- [ ] **Korak 6: napravi karticu**

`.../detail/card-contact-phone.tsx`:

```tsx
import { m } from '@mr/i18n'
import { intakeOrderKeys, updateIntakeOrder, type IntakeOrderDetail } from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

import { InternalButton } from '~/components/internal-button'
import { showInternalToast } from '~/lib/internal-toast'

/**
 * The number the shop may write down when the signed one turns out to be wrong. The signed number
 * is evidence and stays exactly as the owner signed it (docs/25 §5) — so it stays on screen, and
 * stays labelled as the signed one. Without that label the added number quietly takes its place,
 * and the divergence the freeze exists to prevent walks back in through the side door.
 *
 * A draft renders nothing: there the real field is still editable, and a second place to type the
 * same thing is a hole the screen would have to explain (docs/25 §3.0).
 */
export function IntakeContactPhone({
  order,
  canUpdate,
}: {
  order: IntakeOrderDetail
  canUpdate: boolean
}): ReactElement | null {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(order.contactPhone ?? '')

  const save = useMutation({
    mutationFn: (value: string | null) => updateIntakeOrder(order.id, { contactPhone: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
      showInternalToast(m.intake_contact_phone_saved())
    },
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  if (order.signedAt === null) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase text-mri-text2">
        {m.intake_contact_phone_label()}
      </span>

      {canUpdate ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={m.intake_contact_phone_placeholder()}
            className="mri-input min-w-[200px] flex-1 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 py-2 font-sans text-[13.5px] text-mri-text outline-none"
          />
          <InternalButton
            type="button"
            variant="ghost"
            disabled={save.isPending || draft.trim().length < 3}
            onClick={() => save.mutate(draft.trim())}
          >
            {m.intake_contact_phone_save()}
          </InternalButton>
          {order.contactPhone === null ? null : (
            <InternalButton
              type="button"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                setDraft('')
                save.mutate(null)
              }}
            >
              {m.intake_contact_phone_clear()}
            </InternalButton>
          )}
        </div>
      ) : (
        <span className="text-[13.5px] text-mri-text">{order.contactPhone ?? '—'}</span>
      )}

      {/* Never hidden, never quieter than the added number: the paper says this one. */}
      <span className="text-[12px] text-mri-text2">
        {m.intake_contact_phone_signed_hint({ phone: order.ownerPhone })}
      </span>
    </div>
  )
}
```

- [ ] **Korak 7: montiraj je u kartici osnovnih podataka**

U `tab-overview.tsx` dodaj prop `canUpdate: boolean` (prosleđuje ga `$id.tsx` iz zadatka 2) i u ćeliju ispod telefona vlasnika:

```tsx
        <IntakeContactPhone order={order} canUpdate={canUpdate} />
```

- [ ] **Korak 8: pokreni i potvrdi da PROLAZI**

Run: `pnpm --filter internal-web test -- card-contact-phone tab-overview --run`
Expected: PASS.

- [ ] **Korak 9: mutacije**

| Mutacija | Mora da obori |
|---|---|
| obriši blok `{m.intake_contact_phone_signed_hint(...)}` | „keeps the signed number visible" |
| `order.signedAt === null` → `false` | „renders nothing at all on a draft" |
| `canUpdate ?` → `true ?` | „offers no input without update permission" |

- [ ] **Korak 10: dokaži da dopisani broj NE ide na papir**

U `.../print/__tests__/intake-print-data.test.ts`:

```ts
it('never carries the added contact number onto the sheet', () => {
  const model = buildIntakePrintModel(
    intakeOrderDetailFixture({ ownerPhone: '+381 11 111', contactPhone: '+381 64 999' }),
    'sr',
  )

  // The paper is the signed record. The working note has no business on it (docs/25 §5).
  expect(JSON.stringify(model)).not.toContain('+381 64 999')
})
```

⚠ Potpis `buildIntakePrintModel(order, locale)` prepiši iz postojećih testova u tom fajlu — drugi argument može biti objekat sa opcijama.

Run: `pnpm --filter internal-web test -- intake-print-data --run`
Expected: PASS bez ijedne izmene proizvodnog koda — model štampe nikad nije ni znao o polju. Ako PADNE, negde je `...order` prosut u model i to je prava greška koju treba popraviti.

- [ ] **Korak 11: obriši mrtve natpise iz oba jezika**

Za svaki ključ pokreni `grep -rn "m\.<ključ>(" apps packages --include='*.ts' --include='*.tsx'`; ako je **nula pogodaka**, obriši ga iz `sr.json` I `en.json`:

`intake_amend_start` · `intake_amend_bar_tag` · `intake_amend_bar_note` · `intake_amend_cancel` · `intake_amend_save` · `intake_amend_confirm_title` · `intake_amend_confirm_description` · `intake_amend_confirm_photos` · `intake_amend_confirm_button` · `intake_amend_saved` · `intake_amend_nothing_changed` · `intake_amend_phone_invalid` · `intake_amend_locked` · `intake_amended_hint` · `intake_detail_amended_badge` · `intake_detail_amended_by_unknown` · `intake_signature_note_amended` · `intake_history_amended` · `intake_history_amended_contact` · `intake_print_amended` · `intake_photo_add` · `intake_photo_add_title` · `intake_photo_add_description` · `intake_photo_add_stamp_warning` · `intake_photo_add_confirm` · `intake_photo_delete_title` · `intake_photo_delete_description` · `intake_photo_delete_confirm` · `intake_photo_deleted` · `intake_detail_remove` · `intake_detail_remove_confirm` · `intake_detail_remove_description` · `intake_detail_remove_title`

Umiru i **`intake_history_photo_added`** i **`intake_history_photo_removed`**: bili su vezani na prelaze `amend_photo_added`/`amend_photo_removed`, a golo `photo_uploaded`/`photo_removed` repozitorijum **filtrira iz Istorije u SQL-u** (`intake-orders.repository.ts:677-680`), pa posle H nijedan događaj o fotografiji ne stiže do te mape.

⚠ **OSTAJU** (grep će to pokazati, ali da se ne obrišu iz zamaha): `intake_photo_preview` — dugme za pregled fotografije i dalje postoji · `intake_detail_removed_note` i `intake_detail_removed_toast` — traka „Uklonjeni", koja se po §7 speca ne dira · `intake_history_removed` i `intake_history_restored` — `soft_delete`/`restore` ostaju u mapi iz istog razloga.

- [ ] **Korak 12: prevedi i potvrdi parnost**

Run: `pnpm --filter @mr/i18n run compile && pnpm --filter @mr/i18n test`
Expected: prolazi, provera parnosti sr/en zelena.

- [ ] **Korak 13: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/i18n
git commit -m "feat(intake): the office can write a second number down, with the signed one still on screen"
```

---
## Zadatak 6: migracija briše `amended_at` i `amended_by` (H-4)

**Files:**

- Modify: `packages/db/src/schema/intake-orders.ts` (dve kolone, strani ključ `intake_orders_amended_by_fkey`, relacija `amender`)
- Create: `packages/db/migrations/0039_*.sql` (generiše `drizzle-kit`)

**Interfaces:**

- Consumes: ništa u kodu više ne čita ni ne piše te kolone (zadaci 2 i 4).
- Produces: šema bez kolona žiga.

- [ ] **Korak 1: dokaži da ih ništa ne čita**

Run: `grep -rn "amendedAt\|amendedBy\|amended_at\|amended_by" apps packages --include='*.ts' --include='*.tsx'`
Expected: pogodci **samo** u `packages/db/src/schema/intake-orders.ts` (+ generisani `packages/db/migrations/*` i snapshoti, koji su istorija i ne diraju se). Ako ih ima igde drugde — **STANI**, nešto je ostalo iz zadataka 2 ili 4.

- [ ] **Korak 2: obriši ih iz šeme**

Obriši:

```ts
    /** Set when the intake condition is corrected after signing — drives the print marker. */
    amendedAt: timestamp('amended_at', { withTimezone: true, mode: 'date' }),
    amendedBy: uuid('amended_by'),
```

blok `foreignKey({ name: 'intake_orders_amended_by_fkey', … })`, i relaciju `amender` u `intakeOrdersRelations`.

- [ ] **Korak 3: generiši migraciju**

Run: `pnpm --filter @mr/db run db:generate`
Expected: `packages/db/migrations/0039_<ime>.sql`.

- [ ] **Korak 4: pročitaj SQL i potvrdi šta briše**

Run: `cat packages/db/migrations/0039_*.sql`
Expected — strani ključ pa dve kolone, i **ništa drugo**:

```sql
ALTER TABLE "intake_orders" DROP CONSTRAINT "intake_orders_amended_by_fkey";--> statement-breakpoint
ALTER TABLE "intake_orders" DROP COLUMN "amended_at";--> statement-breakpoint
ALTER TABLE "intake_orders" DROP COLUMN "amended_by";
```

- [ ] **Korak 5: STANI i traži Nikolino IZRIČITO odobrenje**

Ovo je **migracija koja briše podatke** — `CLAUDE.md` §3 je zabranjuje bez njegove reči. Prvo izmeri pa mu pokaži brojku:

```bash
docker exec -it mr-reklamacije-postgres psql -U mr -d mr_reklamacije \
  -c "select count(*) from intake_orders where amended_at is not null"
```

Reci mu: grana nije na `main`, u produkciji tih kolona nema, a u razvojnoj bazi je to brojka gore. **Ne primenjuj bez njegove reči.**

- [ ] **Korak 6: primeni i dokaži lanac od nule**

Run: `pnpm --filter @mr/db run db:migrate`
Run: `pnpm test:integration`
Expected: oba zelena — drugo je dokaz da lanac 0000..0039 prolazi na praznoj bazi.

- [ ] **Korak 7: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages/db
git commit -m "refactor(db): the stamp columns leave, now that nothing reads them"
```

---

## Posle plana

- [ ] **Prolaz kroz brauzer** — Nikolin Chrome i njegov `pnpm dev:all`; **ne pokretati svoj server.** Potpisan nalog: nema „Ispravi", nema „Ukloni nalog", nema bedža, pregled štampe nema oznaku izmene, tab Fotografije nema `+` ni brisanje · dopiši broj za kontakt i potvrdi da **potpisani broj ostaje na ekranu** · Istorija ima red „Dopisan broj za kontakt" · nacrt **nema** polje za kontakt, a njegov telefon se i dalje normalno ispravlja.
- [ ] **Zapiši u dnevnik** `.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md` — nov uokvireni blok na dno: stanje grane, šta je mutacija oborila, šta merenje pokazalo.
- [ ] **Prijavi Nikoli, ne diraj:** posledica ㉗ iz §7 speca — `softDelete`/`restore`/„Uklonjeni" ostaju bez ijednog puta, jer je potpisan nalog bio njihov jedini izvor.
