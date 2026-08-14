# Primopredaja i drugi dokument (F) — plan primene

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vozilo se predaje vlasniku kroz primopredaju sa dva potpisa i drugim dokumentom, koji nosi sve iz prvog plus sve što je posle njega urađeno.

**Architecture:** Šest kolona na `intake_orders`, ogledalo postojećih šest za prijem. Postojeći put dokumenta (pečaćenje → skladište → SHA-256 → mejl → ponovno slanje) se **parametrizuje vrstom dokumenta** umesto da se duplira — jedna cev, dva dokumenta. Papir primopredaje je nova komponenta u `@mr/intake-document` koja **teče** na više strana, jer je list prijema kutija tačnih mera i ne može da se rastegne.

**Tech Stack:** Drizzle + PostgreSQL · Hono · Zod (`@mr/shared`) · React 19 + TanStack Start (internal-web) · `renderToStaticMarkup` + Chromium (`core/pdf`) · Paraglide (`@mr/i18n`) · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-intake-handover-f-design.md`

## Global Constraints

- **Migracija se generiše `drizzle-kit`-om, nikad rukom.** Broj se čita iz `packages/db/migrations/meta/_journal.json` u trenutku rada — spec ga namerno ne imenuje. Lanac od nule se dokazuje pre primene.
- **Nema nove dozvole.** Primopredaja sa potpisima = `intake_orders.advance`; „predato bez potpisa" = `intake_orders.change_status`; slanje dokumenta = postojeća `intake_orders.send_document`.
- **Postojeća putanja u skladištu se NE menja.** `intake/<id>/document.pdf` ostaje za prijem; primopredaja dobija `intake/<id>/handover.pdf`. Promena prve bi osirotela svaki već zapečaćen fajl.
- **Odbijanje izmene ide na IME polja, nikad na vrednost** (`assertPostSigningPatchAllowed`).
- **Svaki korisnički tekst kroz Paraglide**, oba jezika, `sr` primarni, **bez ICU množine**. Posle izmene `messages/*.json` obavezno `pnpm --filter @mr/i18n run compile`.
- **Boje samo kroz tokene.** Papir nosi svoje ugrađene stilove (`intake-print-styles.ts`), ekran `--mri-*` klase — **nikad `var(--mri-*)` u SVG atributu**, taj `var()` se ne razrešava.
- **Pun gejt zelen pre svakog komita:** `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`. Iz **korena repoa** — iz `apps/api` turbo pusti 15 zadataka umesto 62 i izgleda zeleno.
- **Ne pokretati i ne gasiti dev servere.** `pnpm dev:all` je Nikolin terminal.

---

## Redosled i zašto

Zadatak 2 (parametrizacija cevi) ide **pre** svega što piše u nove kolone, iz razloga koji je H naučio na svojoj koži: polovično stanje mora da prođe `typecheck`. Kolone prvo (1), pa refaktor bez promene ponašanja (2), pa žica (3), pa papir (4), pa server (5), pa ekran (6).

⚠️ **Zamka koju je H platio i koja važi i ovde:** novo polje na `IntakeOrderDetailSchema` je **OBAVEZNO** polje na žici, pa obara **svaki** test detalja i štampe dok se fikstura ne dopuni. Zadatak 3 zato menja šemu i fiksturu **u istom komitu** — ne može da se podeli.

---

### Task 1: Sedam kolona

**Files:**
- Modify: `packages/db/src/schema/intake-orders.ts` (posle `documentEmailedAt`, oko linije 153)
- Create: `packages/db/migrations/<NNNN>_<naziv>.sql` (generisano)
- Modify: `packages/db/migrations/meta/_journal.json` (generisano)

**Interfaces:**
- Produces: `intakeOrders.handoverTechnicianId`, `.handoverTechnicianSignature`, `.handoverOwnerSignature`, `.handoverSignedAt`, `.handoverDocumentStoragePath`, `.handoverDocumentSha256`, `.handoverDocumentEmailedAt` — sve `nullable`, bez `default`.

- [ ] **Step 1: Dopiši kolone u šemu**

U `packages/db/src/schema/intake-orders.ts`, odmah posle `documentEmailedAt`:

```ts
    /**
     * Primopredaja — ogledalo šest kolona iznad, i ta simetrija je namerna: isti oblik potpisa, isti
     * oblik pečata, isti oblik „poslato". Dokument 2 nosi sve iz dokumenta 1 plus sve posle njega
     * (docs/25 §3.5), pa mu i zapis mora izgledati isto.
     *
     * Sve nullable i bez popune postojećih redova: NULL je istina o nalogu koji nije predat, a
     * `status = 'preuzeto'` uz `handover_signed_at IS NULL` JESTE zapis da je predat bez potpisa
     * (odluka ② u specu) — zato za taj izlaz nema svoje kolone koja bi se s njim razišla.
     */
    /**
     * WHO handed the vehicle over, and deliberately its own column rather than reusing
     * `technician_id`: the intake's technician is whoever received the car, and the man standing at
     * the counter at closing time is often somebody else. The paper has to name the person who was
     * actually there, or it names the wrong one on a document two people sign.
     */
    handoverTechnicianId: uuid('handover_technician_id').references(() => users.id),
    handoverTechnicianSignature: text('handover_technician_signature'),
    handoverOwnerSignature: text('handover_owner_signature'),
    handoverSignedAt: timestamp('handover_signed_at', { withTimezone: true, mode: 'date' }),
    handoverDocumentStoragePath: text('handover_document_storage_path'),
    handoverDocumentSha256: text('handover_document_sha256'),
    handoverDocumentEmailedAt: timestamp('handover_document_emailed_at', {
      withTimezone: true,
      mode: 'date',
    }),
```

- [ ] **Step 2: Pročitaj poslednji broj migracije PRE generisanja**

Run: `tail -20 packages/db/migrations/meta/_journal.json`
Expected: poslednji `idx` i `tag`. Zapamti ga — sledeća migracija mora biti tačno `idx + 1`.

- [ ] **Step 3: Generiši migraciju**

Run: `pnpm --filter @mr/db run db:generate`
Expected: nov `.sql` sa **sedam** `ALTER TABLE "intake_orders" ADD COLUMN` plus jedan `ADD CONSTRAINT ... FOREIGN KEY` za `handover_technician_id`, i ničim drugim.

- [ ] **Step 4: Pročitaj generisani SQL i potvrdi da nema ničeg drugog**

Run: `cat packages/db/migrations/<novi>.sql`
Expected: sedam `ADD COLUMN` + jedan strani ključ, nijedan `DROP`, nijedan `ALTER ... TYPE`.
⚠️ **Indeks na `handover_technician_id` ne pravi Drizzle sam** (`docs/06`: strani ključevi se indeksiraju ručno). Ovde se **ne dodaje** — po toj koloni se ne filtrira ni ne sortira, čita se samo kroz već učitan red. Ako se ikad pojavi „nalozi koje sam ja predao", indeks ide tada.
⚠️ Ako se pojavi bilo šta drugo — stani i prijavi. Migracija koja briše kolonu sa parcijalnog indeksa odnosi indeks sa sobom (naučeno na `0040`).

- [ ] **Step 5: Dokaži lanac od nule**

Run: `pnpm test:integration`
Expected: prolazi. Globalni setup radi migraciju od nule na `mr_reklamacije_test`, pa zelen `test:integration` dokazuje lanac.

- [ ] **Step 6: Primeni lokalno**

Run: `pnpm --filter @mr/db run db:migrate`
Expected: `<novi>` applied.

- [ ] **Step 7: Pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages/db
git commit -m "feat(db): the order records its handover the way it records its intake"
```

---

### Task 2: Jedna cev, dva dokumenta

Refaktor **bez promene ponašanja.** Dokaz da je bez promene su postojeći testovi, koji se ne diraju.

**Files:**
- Modify: `apps/api/src/infrastructure/storage/storage.interface.ts:51`
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts:494-535`
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts:166, 520-670`
- Test: postojeći `apps/api/src/modules/intake-orders/__tests__/intake-document-email.integration.test.ts` i `intake-document.http.integration.test.ts` — **ne menjaju se**

**Interfaces:**
- Produces:
  - `type IntakeDocumentKind = 'intake' | 'handover'`
  - `buildIntakeDocumentStoragePath(orderId: string, kind: IntakeDocumentKind): string`
  - `repo.findDocument(id: string, kind: IntakeDocumentKind): Promise<IntakeDocumentRow | null>`
  - `repo.setDocument(id: string, kind: IntakeDocumentKind, document: { storagePath: string; sha256: string }): Promise<void>`
  - `repo.setDocumentEmailedAt(id: string, kind: IntakeDocumentKind, at: Date): Promise<void>`
  - `service.produceDocument(id: string, kind: IntakeDocumentKind): Promise<void>`

- [ ] **Step 1: Napiši test koji pada — putanja po vrsti**

U `apps/api/src/infrastructure/storage/__tests__/storage-paths.test.ts` (novi fajl ako ga nema):

```ts
import { describe, expect, it } from 'vitest'

import { buildIntakeDocumentStoragePath } from '../storage.interface.js'

describe('buildIntakeDocumentStoragePath', () => {
  it('keeps the intake path it has always used', () => {
    // Changing this orphans every sealed file already in the bucket.
    expect(buildIntakeDocumentStoragePath('abc', 'intake')).toBe('intake/abc/document.pdf')
  })

  it('gives the handover its own file beside it', () => {
    expect(buildIntakeDocumentStoragePath('abc', 'handover')).toBe('intake/abc/handover.pdf')
  })
})
```

- [ ] **Step 2: Pusti test, potvrdi da pada**

Run: `pnpm --filter api exec vitest run src/infrastructure/storage`
Expected: FAIL — `Expected 1 arguments, but got 2` ili pogrešna putanja.

- [ ] **Step 3: Parametrizuj putanju**

U `apps/api/src/infrastructure/storage/storage.interface.ts`:

```ts
export type IntakeDocumentKind = 'intake' | 'handover'

/** The intake keeps `document.pdf` it has always had — renaming it would orphan every sealed file. */
const INTAKE_DOCUMENT_FILE_NAME: Record<IntakeDocumentKind, string> = {
  intake: 'document.pdf',
  handover: 'handover.pdf',
}

export function buildIntakeDocumentStoragePath(
  orderId: string,
  kind: IntakeDocumentKind,
): string {
  return `intake/${orderId}/${INTAKE_DOCUMENT_FILE_NAME[kind]}`
}
```

- [ ] **Step 4: Pusti test, potvrdi da prolazi**

Run: `pnpm --filter api exec vitest run src/infrastructure/storage`
Expected: PASS (2 testa).

- [ ] **Step 5: Parametrizuj repo — tri metode kroz jednu mapu kolona**

U `intake-orders.repository.ts`, iznad `setDocument`:

```ts
/**
 * Which six columns a document kind lives in. A map and not a branch per method: three methods
 * each carrying their own `if` is three places for the two kinds to drift apart.
 */
const DOCUMENT_COLUMNS = {
  intake: {
    storagePath: intakeOrders.documentStoragePath,
    sha256: intakeOrders.documentSha256,
    emailedAt: intakeOrders.documentEmailedAt,
    signedAt: intakeOrders.signedAt,
  },
  handover: {
    storagePath: intakeOrders.handoverDocumentStoragePath,
    sha256: intakeOrders.handoverDocumentSha256,
    emailedAt: intakeOrders.handoverDocumentEmailedAt,
    signedAt: intakeOrders.handoverSignedAt,
  },
} as const satisfies Record<IntakeDocumentKind, Record<string, AnyPgColumn>>
```

Zatim `setDocument`, `setDocumentEmailedAt` i `findDocument` uzimaju `kind` kao **drugi** argument i čitaju kolone iz mape. `findDocument` vraća isti oblik kao danas — `signedAt` je sada potpis TE vrste.

- [ ] **Step 6: Parametrizuj servis**

`documentsBeingSealed` se ključa po nalogu **i vrsti**, jer dva dokumenta istog naloga smeju paralelno:

```ts
  /** One flight per document, not per order: the two documents of one order may seal at once. */
  private readonly documentsBeingSealed = new Map<string, Promise<void>>()
```

```ts
  async produceDocument(id: string, kind: IntakeDocumentKind): Promise<void> {
    const key = `${id}:${kind}`
    const running = this.documentsBeingSealed.get(key)
    if (running !== undefined) {
      return running
    }

    const sealing = this.sealDocument(id, kind).finally(() => {
      this.documentsBeingSealed.delete(key)
    })
    this.documentsBeingSealed.set(key, sealing)
    return sealing
  }
```

`sealDocument`, `sendSealedDocument`, `deliverDocument`, `produceDocumentInBackground`, `sendDocument` i `getDocumentDownloadMeta` svi dobijaju `kind`. **Crtanje i mejl još nemaju granu za `handover`** — dok Zadatak 4 i 5 ne stignu, `sealDocument` za `handover` baca `new Error('not built')`, i to je jedina privremena linija u planu. Svi postojeći pozivaoci prosleđuju `'intake'`.

- [ ] **Step 7: Pusti postojeće testove dokumenta — dokaz da se ponašanje nije pomerilo**

Run: `pnpm --filter api exec vitest run src/modules/intake-orders`
Expected: PASS, **bez ijedne izmene u tim testovima**. Ako je test morao da se menja, ponašanje se pomerilo i refaktor nije refaktor.

- [ ] **Step 8: Mutacija — dokaži da putanja prijema stvarno drži**

Promeni `intake: 'document.pdf'` u `intake: 'intake.pdf'`, pusti `vitest run src/infrastructure/storage`.
Expected: FAIL. Vrati nazad **Edit-om, nikad `git checkout <fajl>`** — checkout odnese ceo zadatak, ne samo mutaciju.

- [ ] **Step 9: Pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/api
git commit -m "refactor(api): one document pipeline, told which document it is sealing"
```

---

### Task 3: Žica i drugo zamrzavanje

⚠️ **Šema i fikstura u ISTOM komitu.** Novo polje na `IntakeOrderDetailSchema` je obavezno polje i obara svaki test detalja i štampe dok fikstura ne ponese vrednost.

**Files:**
- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts:293-302`
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts:85` (`FREE_AFTER_SIGNING`)
- Modify: `packages/intake-document/src/testing/index.ts` (fikstura detalja)
- Test: `apps/api/src/modules/intake-orders/__tests__/` — nov `handover-freeze.test.ts`

**Interfaces:**
- Produces: na `IntakeOrderDetail` — `handoverSignedAt: string | null`, `handoverDocumentReady: boolean`, `handoverDocumentEmailedAt: string | null`; funkcija `freeFieldsFor(signedAt: Date | null, handoverSignedAt: Date | null): readonly string[]`

- [ ] **Step 1: Napiši test koji pada — dva zamrzavanja**

Nov `apps/api/src/modules/intake-orders/__tests__/handover-freeze.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { freeFieldsFor } from '../intake-orders.service.js'

const T = new Date('2026-08-15T10:00:00Z')

describe('what a signed order still allows', () => {
  it('allows everything before the intake is signed', () => {
    expect(freeFieldsFor(null, null)).toBeNull()
  })

  it('leaves the specification alive between the two signings', () => {
    // The serviser must be able to remove material he does not need (Nikola, 11.08.).
    expect(freeFieldsFor(T, null)).toEqual(['services', 'materials', 'contactPhone'])
  })

  it('closes the specification at handover, and keeps only the phone', () => {
    // contactPhone survives both on purpose: it is never printed, and a wrong number stays wrong
    // after the car leaves.
    expect(freeFieldsFor(T, T)).toEqual(['contactPhone'])
  })
})
```

- [ ] **Step 2: Pusti test, potvrdi da pada**

Run: `pnpm --filter api exec vitest run src/modules/intake-orders/__tests__/handover-freeze.test.ts`
Expected: FAIL — `freeFieldsFor is not a function`.

- [ ] **Step 3: Zameni listu funkcijom stanja**

U `intake-orders.service.ts`, umesto `const FREE_AFTER_SIGNING = [...]`:

```ts
/**
 * What a signed order still accepts, and it narrows twice.
 *
 * Nikola, 11.08.: the intake signatures close everything the receiving worker entered; the handover
 * signatures close the Specification as well. Between them the Specification stays alive, because
 * the serviser must be able to remove material he does not need.
 *
 * `contactPhone` survives both deliberately — it is the shop's working note, it is NEVER printed,
 * and the need to correct a wrong number does not end when the car leaves.
 *
 * `null` means no freeze at all. Takes the two dates rather than two booleans so a swapped argument
 * at the call site is a type error.
 */
export function freeFieldsFor(
  signedAt: Date | null,
  handoverSignedAt: Date | null,
): readonly string[] | null {
  if (signedAt === null) {
    return null
  }
  return handoverSignedAt === null ? ['services', 'materials', 'contactPhone'] : ['contactPhone']
}
```

`assertPostSigningPatchAllowed` uzima obe vrednosti i vraća se odmah kada je `freeFieldsFor` `null`.

- [ ] **Step 4: Pusti test, potvrdi da prolazi**

Run: `pnpm --filter api exec vitest run src/modules/intake-orders/__tests__/handover-freeze.test.ts`
Expected: PASS (3 testa).

- [ ] **Step 5: Dopiši žicu**

U `packages/shared/src/schemas/intake-order.wire.schema.ts`, uz `documentReady` (linija ~300):

```ts
  /** Whether the handover is signed. The signatures themselves ride beside it, like the intake's. */
  handoverTechnicianSignature: z.string().nullable(),
  handoverOwnerSignature: z.string().nullable(),
  handoverSignedAt: z.string().nullable(),
  /** Whether the sealed handover exists. The storage path never leaves the server. */
  handoverDocumentReady: z.boolean(),
  handoverDocumentEmailedAt: z.string().nullable(),
```

- [ ] **Step 6: Dopiši fiksturu istog trenutka**

U `packages/intake-document/src/testing/index.ts`, u fiksturi detalja, pet novih polja:
`handoverTechnicianSignature: null`, `handoverOwnerSignature: null`, `handoverSignedAt: null`,
`handoverDocumentReady: false`, `handoverDocumentEmailedAt: null`.

- [ ] **Step 7: Mapiranje u repou**

`intake-orders.repository.ts` `findById` — pet polja iz reda u žicu, `handoverDocumentReady` je `row.handoverDocumentStoragePath !== null` (nikad sama putanja).

- [ ] **Step 8: Pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages apps/api
git commit -m "feat(intake): the handover reaches the wire, and the second freeze closes the specification"
```

---

### Task 4: Papir koji teče

**Files:**
- Create: `packages/intake-document/src/intake-handover-sheet.tsx`
- Create: `packages/intake-document/src/intake-handover-styles.ts`
- Modify: `packages/intake-document/src/index.ts`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`
- Test: `packages/intake-document/src/__tests__/intake-handover-sheet.test.tsx`

**Interfaces:**
- Consumes: `IntakeOrderDetail` (Task 3), `IntakeChecklistItemListItem`
- Produces: `IntakeHandoverSheet({ order, checklistItems, locale, logoSrc, id }): ReactElement`

- [ ] **Step 1: Napiši test koji pada — ništa se ne krati**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { intakeChecklistCatalogFixture, intakeOrderDetailFixture } from '../testing/index.js'
import { IntakeHandoverSheet } from '../intake-handover-sheet.js'

describe('the handover sheet', () => {
  it('prints every service and every material, however many there are', () => {
    // The whole purpose is that nothing is missing: an omission is the first thing a dissatisfied
    // owner reaches for (docs/25 §3.5). No "…and N more — see the order" line, ever.
    const services = Array.from({ length: 40 }, (_, i) => `Usluga ${i + 1}`)
    render(
      <IntakeHandoverSheet
        order={{ ...intakeOrderDetailFixture(), services, materials: [] }}
        checklistItems={intakeChecklistCatalogFixture()}
        locale="sr"
        logoSrc="/x.png"
      />,
    )

    expect(screen.getByText('Usluga 1')).toBeInTheDocument()
    expect(screen.getByText('Usluga 40')).toBeInTheDocument()
  })

  it('says so when no work was recorded, rather than printing an empty block', () => {
    render(
      <IntakeHandoverSheet
        order={{ ...intakeOrderDetailFixture(), services: [], materials: [] }}
        checklistItems={intakeChecklistCatalogFixture()}
        locale="sr"
        logoSrc="/x.png"
      />,
    )

    expect(screen.getByText(/nisu zabeleženi/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Pusti test, potvrdi da pada**

Run: `pnpm --filter @mr/intake-document exec vitest run src/__tests__/intake-handover-sheet.test.tsx`
Expected: FAIL — modul ne postoji.

- [ ] **Step 3: Napiši list**

Struktura, odozgo nadole: zaglavlje (traka, amblem, broj naloga) · **PRIMLJENO** — isto što je vlasnik potpisao (osnovni podaci, zatečeno stanje, gorivo, nedostaci) · **IZVEDENI RADOVI** (`services`) · **MATERIJAL** (`materials`) · završna rečenica primopredaje · **potpisi, poslednji**.

⚠️ **Fotografije ne ulaze** (odluka ⑦, nasleđena od 13.08.): dokument 2 nosi sve što nosi dokument 1, a fotografije nikad nisu bile na njemu.

⚠️ **Ime onoga ko predaje** dolazi iz `handoverTechnicianId`, ne iz `technicianId` — drugi čovek potpisuje drugi put.

⚠️ Ovaj list **nije** `IntakePrintSheet` sa većom visinom. Bez `height: 1123px`, bez `flex: 1` na telu, bez `marginTop: 'auto'` na podnožju — sve to su alati kutije tačnih mera i u toku prelamanja rade suprotno od nameravanog. Stilovi su ugrađeni objekti, kao u `intake-print-styles.ts`, i list **imenuje fontove** (`DOCUMENT_FONT_SANS`/`_MONO`) umesto da ih nasledi.

Novi ključevi u `sr.json` + `en.json`: `intake_handover_title`, `intake_handover_section_received`, `intake_handover_section_services`, `intake_handover_section_materials`, `intake_handover_no_work`, `intake_handover_statement`, `intake_handover_signature_technician`, `intake_handover_signature_owner`.

⚠️ `intake_handover_statement` je jedina rečenica na papiru koja je **pravna izjava** — piše se po odluci ② u §8 speca (upoznat sa izvedenim radovima, saglasan, preuzima vozilo) i **pokazuje se Nikoli pre nego što se odštampa.**

- [ ] **Step 4: Pusti test, potvrdi da prolazi**

Run: `pnpm --filter @mr/intake-document exec vitest run src/__tests__/intake-handover-sheet.test.tsx`
Expected: PASS (2 testa).

- [ ] **Step 5: IZMERI prelamanje — ne pretpostavljaj ga**

Napiši privremenu skriptu u scratchpadu koja crta list sa **3, 25 i 80** stavki, provuče ga kroz `PdfRenderer` i ispiše broj strana + `pdfinfo`-oblik. Traže se tri odgovora:

1. Da li se zaglavlje ponavlja? Chromium nema `position: running()`. Ako ne — odluči: zaglavlje samo na prvoj strani, ili `headerTemplate` (što traži da `PdfRenderer.renderDocument` prosledi te opcije, danas ih ne prosleđuje).
2. Da li podnožje nosi „2 / 3"? Bez broja strane izgubljena strana je nevidljiva.
3. **Da li se blok potpisa prelomi od naslova?** Napravi ulaz koji se prelama tačno tu i pogledaj.

⚠️ Snimaj **ceo dokument odjednom** — snimak pojedinačnog elementa posle skrola vraća duh prethodnog kadra.

- [ ] **Step 6: Zapiši izmereno u kod, kao komentar iznad stila koji ga rešava**

Ne u plan, ne u poruku komita — u fajl, uz brojeve.

- [ ] **Step 7: Pun gejt i komit**

```bash
pnpm --filter @mr/i18n run compile
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages
git commit -m "feat(intake): the handover sheet, which flows onto as many pages as it needs"
```

---

### Task 5: Server predaje vozilo

**Files:**
- Create: `apps/api/src/modules/intake-orders/intake-handover-pdf.ts`
- Create: `apps/api/src/modules/intake-orders/intake-handover.email.ts`
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts`, `.controller.ts`, `.routes.ts`, `.validators.ts`
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-handover.integration.test.ts`

**Interfaces:**
- Consumes: `produceDocument(id, 'handover')` (Task 2), `IntakeHandoverSheet` (Task 4)
- Produces: `POST /api/intake-orders/:id/handover` (`intake_orders.advance`) i `POST /api/intake-orders/:id/handover/skip` (`intake_orders.change_status`)

- [ ] **Step 1: Napiši testove koji padaju**

Integracioni test pokriva pet stvari: potpisana primopredaja diže status na `preuzeto` i puni `handover_signed_at` · dokument se zapečati i pošalje vlasniku · **druga primopredaja je 409** · **primopredaja nepotpisanog prijema je 409** (nema šta da se preda) · `skip` diže status a ostavlja `handover_signed_at` prazan.

⚠️ Svaki test koji pečati mora `container.pdfRenderer.dispose()` u `afterEach` — inače svaki test drži svoj Chromium.
⚠️ HTTP paket mora `ensureTestUser`: audit ima pravi strani ključ, inače ruta vraća 500 bez veze sa rutom.
⚠️ „Napravljeno jednom" se **ne** testira poređenjem otisaka — dva crtanja u istoj sekundi daju bajt-identičan PDF. Upiši **sentinel** u skladište pa tvrdi da ga niko nije prepisao.

- [ ] **Step 2: Pusti testove, potvrdi da padaju**

Run: `pnpm --filter api exec vitest run --config vitest.integration.config.ts src/modules/intake-orders/__tests__/intake-handover.integration.test.ts`
Expected: FAIL — ruta 404.

- [ ] **Step 3: `handOver()` u servisu**

Redom: `loadVisible` → 409 ako `signedAt === null` → 409 ako `handoverSignedAt !== null` → `repo.handOver(id, input, actor.userId)` (piše dva potpisa, **`handover_technician_id = actor.userId`**, `handover_signed_at = now()`, `status = 'preuzeto'`, sve u jednom `UPDATE`) → audit `{ transition: 'handover' }` → `signalChanged()` → `produceDocumentInBackground(id, 'handover')`.

⚠️ `handover_technician_id` je **onaj ko poziva**, nikad vrednost iz tela zahteva — potpis pod tuđim imenom je tačno ono što dokument treba da onemogući.

Pečaćenje ide **posle** što je potpis činjenica i nikad kao deo njega: pad Chromiuma ne sme da poništi potpis koji je vlasnik već dao stojeći kraj auta.

- [ ] **Step 4: `handOverWithoutSignature()`**

`loadVisible` → 409 ako `signedAt === null` → 409 ako je već `preuzeto` → `status = 'preuzeto'`, **`handover_signed_at` ostaje NULL** → audit `{ transition: 'handover_skipped' }` → `signalChanged()`. **Nikakav dokument se ne pravi** — nema šta da se zapečati.

- [ ] **Step 5: Rute**

```ts
  routes.post('/:id/handover', requirePermission('intake_orders.advance'), controller.handOver)
  routes.post(
    '/:id/handover/skip',
    requirePermission('intake_orders.change_status'),
    controller.handOverWithoutSignature,
  )
```

- [ ] **Step 6: Crtanje i mejl**

`intake-handover-pdf.ts` je bliznak `intake-document-pdf.ts` — `renderToStaticMarkup` + isti omotač sa ugrađenim fontovima i amblemom, `printBackground: true`, `preferCSSPageSize: true`, ali **bez** fiksne veličine strane. `intake-handover.email.ts` ide kroz `core/email/email-layout.ts` kao i ostala četiri, dvojezično kao i dokument prijema (vlasnik nije korisnik ničega). Ukloni privremeni `throw` iz Zadatka 2, korak 6.

- [ ] **Step 7: Pusti testove, potvrdi da prolaze**

Run: kao u koraku 2.
Expected: PASS (5 testova).

- [ ] **Step 8: Mutacija — dokaži da druga primopredaja stvarno stane**

Skloni proveru `handoverSignedAt !== null`, pusti testove.
Expected: FAIL na „druga primopredaja je 409". Vrati Edit-om.

- [ ] **Step 9: Pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/api
git commit -m "feat(api): the vehicle goes back with a signed sheet of everything that was done to it"
```

---

### Task 6: Ekran primopredaje

**Files:**
- Create: `apps/internal-web/src/features/intake-orders/handover/handover-screen.tsx`
- Create: `apps/internal-web/src/routes/prijem/$id.primopredaja.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/intake-detail-header.tsx:77`
- Modify: `apps/internal-web/src/features/intake-orders/detail/card-document.tsx`
- Test: `apps/internal-web/src/features/intake-orders/handover/__tests__/handover-screen.test.tsx`

**Interfaces:**
- Consumes: `POST /api/intake-orders/:id/handover`, `.../handover/skip` (Task 5); `handoverSignedAt`, `handoverDocumentReady`, `handoverDocumentEmailedAt` (Task 3)

- [ ] **Step 1: Napiši testove koji padaju**

Tri tvrdnje: **PREDAJ VOZILO** je mrtvo dok oba potpisa nisu tu **i rečenica u podnožju kaže koji fali** (isti propis kao korak 1 čarobnjaka, popravljen 15.08.) · **„Predato bez potpisa" se ne prikazuje bez `intake_orders.change_status`** · taj izlaz ide kroz `<ConfirmDialog>` koji imenuje posledicu.

- [ ] **Step 2: Pusti testove, potvrdi da padaju**

Run: `pnpm --filter internal-web exec vitest run src/features/intake-orders/handover`
Expected: FAIL — modul ne postoji.

- [ ] **Step 3: Napiši ekran**

Odozgo nadole: šta je primljeno · šta je rađeno · dva `IntakeSignaturePad`-a (postoje, `viewBox 0 0 460 200`) · **PREDAJ VOZILO**. Ispod, tiho i odvojeno, **„Predato bez potpisa"** iza `<Can>` na `intake_orders.change_status`, kroz `<ConfirmDialog>`.

Zamena za dugme sa potvrdom: u `intake-detail-header.tsx:77`, `needsPickupConfirm` više ne otvara dijalog nego vodi na `/prijem/$id/primopredaja`.

- [ ] **Step 4: Pusti testove, potvrdi da prolaze**

Run: kao u koraku 2.
Expected: PASS (3 testa).

- [ ] **Step 5: Kartica dokumenta prikazuje oba**

`card-document.tsx` danas prikazuje jedan dokument. Dobija drugi red — postoji li, da li i kada je stigao vlasniku, „Preuzmi" i „Pošalji ponovo". Ista dozvola (`intake_orders.send_document`), isti `<ConfirmDialog>` (mejl se ne opoziva).

- [ ] **Step 6: Prolaz kroz pregledač — obavezan, ne opcion**

Pun prolaz: nalog do `gotovo` → primopredaja → oba potpisa → PREDAJ VOZILO → dokument stigne na mejl.
⚠️ Ovo je korak koji je 14.08. našao ono što nijedan test nije mogao (dev je tiho prestao da peča dokument). **Pre prolaza restartuj `dev:all`** — traži to od Nikole, ne diraj mu terminal.
⚠️ Playwright: popuni polja **tek posle hidracije**; klik pre nje šalje formu nativno.

- [ ] **Step 7: Pun gejt i komit**

```bash
pnpm --filter @mr/i18n run compile
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages
git commit -m "feat(intake): the vehicle is handed back on a screen where two people sign"
```

---

## Posle plana

- **`CLAUDE.md` §2** dobija invariantu primopredaje (drugo zamrzavanje, `preuzeto` samo kroz primopredaju ili vidljiv izlaz) — u istom komitu kao Zadatak 6.
- **Nema `db:seed` pred deploj** za F: nijedna nova dozvola. Migracija ide kroz postojeći `db:migrate:deploy`.
- **Ostaje deo E** (serviser prilaže ponudu uz nalog) i **deo D** (rolovi, odložen Nikolinom rečju).
