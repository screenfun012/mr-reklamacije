# G1 — ček-lista postaje katalog kojim upravlja admin: plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Osam stavki ček-liste prestaju da budu konstanta u kodu i postaju katalog koji admin dodaje, gasi, preimenuje i preređuje — a nalog i dalje čuva **kod**, pa se preimenovanje vidi i na starim nalozima.

**Architecture:** Sloj baze već postoji (migracija `0037`, seed, tri dozvole) i ne radi se ponovo. Ostaje API modul po uzoru na `departments`, admin ekran po uzoru na resurs-definicije, pa **pravi posao**: šest mesta koja danas čitaju `INTAKE_CHECKLIST_KEYS` moraju da dobiju katalog. Red je izabran tako da svaki komit ima zelen gejt: prvo API (aditivno), pa admin (aditivno), pa potrošači **dok je šema još zatvorena** (katalog sadrži tačno tih osam kodova, pa se ništa vidljivo ne menja), i tek na kraju otvaranje šeme sa stražom u servisu — čime admin stvarno može da doda devetu stavku.

**Tech Stack:** Hono + Drizzle (PostgreSQL) · TanStack Start (React 19) + TanStack Query · Zod · Vitest (unit + integracija na pravom Postgresu) · Paraglide (sr/en)

## Global Constraints

- **Spec je izvor istine:** `docs/superpowers/specs/2026-08-11-intake-admin-catalogs-design.md`. Odluke se ne re-otvaraju u kodu.
- **Grana:** `feat/vehicle-intake`, osnova `629d3a3`. Nije na `main`, nije u produkciji.
- **Sloj baze NE dirati:** `packages/db/src/schema/catalogs.ts` (tabele `intake_checklist_items`, `intake_damage_types`, `intake_arrival_modes`), `packages/db/src/seed/intake-catalogs.ts`, migracija `0037`. **Nijedna migracija se u ovom planu ne generiše.** Ako ti se čini da treba, stani i prijavi.
- **Ovo je SAMO G1 — ček-lista.** `intake_damage_types` i `intake_arrival_modes` su G2 i G3: tabele im postoje, ali se u ovom planu ne dodiruju.
- **Pun gejt pre SVAKOG komita, i svaki zadatak završava komitom:**
  `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`
- **`--concurrency=4` je obavezan** ako Nikolin `pnpm dev:all` radi. **Nikad ne pokretati ni gasiti razvojne servere**, nikad ne dirati portove 3000–3003.
- **Nikad dva gejta istovremeno** (`@mr/auth` padne bez razloga).
- **Slojevi (CI to proverava):** kontroler nikad ne dira bazu; servis i repozitorijum nikad ne uvoze `hono` ni HTTP tipove; `apps/*` sme da zavisi od `packages/*`, obrnuto **nikad**; DI kroz `apps/api/src/core/container.ts`, bez modul-level singletona.
- **Svaka ruta ima `requirePermission`.** Za ovaj katalog: `settings.intake_checklist.manage` (već postoji u `PERMISSIONS`, namerno **nije** u `OPERATOR_PERMISSIONS` — samo admin).
- **Bez `any`**, bez `!`, bez `enum`, bez tačka-zapeta, jednostruki navodnici, 2 razmaka, trailing comma, imenovani izvozi. Tipizovane domenske greške (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`), nikad go `Error`. Funkcije < 30 linija. Komentari objašnjavaju **zašto**.
- **Audit u SERVISU**, ne u kontroleru — da i direktan poziv upiše trag. Meko brisanje (`deleted_at`), repozitorijum podrazumevano filtrira `deleted_at IS NULL`.
- **SSE je samo signal:** `type + kind + id`, nikad podaci reda. Klijent zove `invalidateQueries`.
- **Svaki natpis ide u `sr.json` I `en.json`** (CI proverava parnost), pa **`pnpm --filter @mr/i18n run compile`** — bez toga ekran mirno prikazuje stari tekst. **Bez ICU množine** — ruši Paraglide u ovom repou.
- **Stil testova:** `await expect(...).rejects.toBeInstanceOf(ValidationError)`, ne `toThrow`. Integracija ide na pravi Postgres; **nikad ne mockovati bazu, Zod, domenske servise ni Hono**. Nov integracioni paket **seje dozvole PRE rola**.
- **Testovi koji dokazuju obrisano ponašanje se BRIŠU, ne prepravljaju.**

---

## Odluke koje ovaj plan donosi (i zašto), pored onih iz speca

| # | Pitanje koje spec ne rešava | Odluka |
|---|---|---|
| **D1** | Kako izgleda `IntakeChecklistSchema` kad se otvori? | `z.record(kod, z.boolean().nullable())` sa kapom na broj ključeva i na dužinu koda. Žica više **ne** presuđuje koji su kodovi dopušteni — to radi servis prema katalogu (odluka ⑭ iz speca). |
| **D2** | Odakle servisu katalog? | `IntakeChecklistItemsRepository` se **ubrizgava** u `IntakeOrdersService` kroz `container.ts`. Provera se radi **samo kad zahtev nosi `checklist`** — čarobnjak patchuje na svakom koraku i ne sme da plati čitanje baze za ništa. |
| **D3** | Šta piše na starom nalogu ako je stavka posle ugašena ili obrisana? | ⚠️ **Prikaz čita katalog BEZ filtera na `is_active`/`deleted_at`; birač u čarobnjaku čita samo aktivne.** Nalog je dokaz: ako ugašena stavka nestane sa potpisanog naloga, zapis tiho gubi red koji je mušterija potpisala. A ako koda nema **nigde** u katalogu (star red, ručno diran podatak), red se prikazuje sa **golim kodom** — nikad se ne izostavlja. |
| **D4** | Koliko je „ukupno" na brojaču? | ⚠️ **Čarobnjak crta KATALOG** (živ izbor, ukupno = koliko katalog nudi). **Detalj i štampa crtaju MAPU KOJU NALOG ČUVA** (ukupno = koliko je redova zabeleženo), a imena vuku iz kataloga. Inače nova stavka u katalogu retroaktivno pretvara stari „3 / 8" u „3 / 9" — a taj nalog nikad nije imao devet redova. |
| **D5** | Šta ako je katalog prazan? | Korak 2 prikazuje **prazno stanje sa uputstvom**, ne praznu karticu. Prazna kartica je slepa ulica, a `docs/25` §3.0 tačka 1 to zabranjuje. Ovo je stvarno dostupno: sveža baza bez `db:seed` (spec §3). |

---

## Struktura fajlova

**Novo:**

| Fajl | Odgovornost |
|---|---|
| `apps/api/src/modules/intake-checklist-items/intake-checklist-items.schema.ts` | re-export tabele iz `@mr/db` |
| `…/intake-checklist-items.validators.ts` | Zod za rutu (parsiranje `:id`, upit liste) |
| `…/intake-checklist-items.repository.ts` | samo baza |
| `…/intake-checklist-items.service.ts` | pravila + audit + SSE |
| `…/intake-checklist-items.controller.ts` | tanak HTTP |
| `…/intake-checklist-items.routes.ts` | `requirePermission` po ruti |
| `…/index.ts` | izvozi |
| `…/__tests__/intake-checklist-items.integration.test.ts` | integracija na pravom Postgresu |
| `apps/admin-web/src/resources/intake-checklist.definition.ts` | deklarativna definicija resursa |
| `apps/admin-web/src/routes/_shell/settings/intake-checklist/index.tsx` | montira `ResourceListPage` |
| `apps/internal-web/src/features/intake-orders/intake-checklist-catalog.ts` | **jedno mesto** koje spaja kodove iz naloga sa imenima iz kataloga (D3/D4) |

**Menja se:**

| Fajl | Šta |
|---|---|
| `packages/shared/src/schemas/intake-checklist-item.schema.ts` (novo) + `schemas/index.ts` | Create/Update/ListItem šeme |
| `packages/shared/src/queries/reference-data.ts` + `queries/index.ts` | `intakeChecklistItemsReferenceOptions` |
| `packages/shared/src/constants/resource-changed-key.ts` (gde `ResourceChangedKey` živi) | nov ključ za SSE |
| `packages/shared/src/schemas/intake-order.schema.ts` | **zadatak 4**: `IntakeChecklistSchema` se otvara, `INTAKE_CHECKLIST_KEYS` odlazi |
| `apps/api/src/core/container.ts` | novi repo + servis; injekcija u `IntakeOrdersService` |
| `apps/api/src/app.ts` (ili gde se rute montiraju) | montira nove rute |
| `apps/api/src/modules/intake-orders/intake-orders.service.ts` | **zadatak 4**: straža na nepoznat kod |
| `apps/internal-web/.../wizard/intake-checklist-grid.tsx` | crta katalog, `countConfirmed` prima kodove |
| `apps/internal-web/.../wizard/step-checklist.tsx` | ukupno iz kataloga, prazno stanje |
| `apps/internal-web/.../wizard/intake-wizard-state.ts` | prazna ček-lista se gradi iz kataloga |
| `apps/internal-web/.../detail/card-condition.tsx` | crta mapu naloga, imena iz kataloga |
| `apps/internal-web/.../print/intake-print-data.ts` + `intake-print-condition.tsx` | model dobija katalog, bira `nameSr`/`nameEn` po jeziku papira |
| `apps/internal-web/.../intake-labels.ts` | `INTAKE_CHECKLIST_LABELS` odlazi |
| `packages/i18n/src/messages/{sr,en}.json` | osam `intake_checklist_<naziv>` odlazi; dodaju se natpisi admin ekrana i praznog stanja |

---

## Zadatak 1: API modul za katalog ček-liste

**Files:**

- Create: sedam fajlova u `apps/api/src/modules/intake-checklist-items/` + `__tests__/intake-checklist-items.integration.test.ts`
- Create: `packages/shared/src/schemas/intake-checklist-item.schema.ts`
- Modify: `packages/shared/src/schemas/index.ts`, `packages/shared/src/queries/reference-data.ts`, `packages/shared/src/queries/index.ts`, `ResourceChangedKey`
- Modify: `apps/api/src/core/container.ts`, i fajl koji montira module u aplikaciju

**Interfaces:**

- Consumes: tabela `intakeChecklistItems` iz `@mr/db` (postoji), dozvola `settings.intake_checklist.manage` (postoji).
- Produces: `GET/POST /api/intake-checklist-items`, `PATCH/DELETE /api/intake-checklist-items/:id` · `IntakeChecklistItemListItem` = `{ id, code, nameSr, nameEn, sortOrder, isActive }` · `IntakeChecklistItemCreateInput` = `{ code, nameSr, nameEn, sortOrder?, isActive? }` · `IntakeChecklistItemUpdateInput` = sve opciono osim `code` · `intakeChecklistItemsReferenceOptions(filters?: { activeOnly: boolean })` · `ResourceChangedKey.IntakeChecklistItems`. Zadaci 2, 3 i 4 se naslanjaju na ove.

- [ ] **Korak 1: pročitaj uzor pre pisanja**

Run: `cat apps/api/src/modules/departments/*.ts`
Ovo je uzor koji prepisuješ, fajl po fajl (~407 linija ukupno). Prepiši **oblik**, ne slepo tekst: ovaj katalog ima `nameSr`/`nameEn` gde `departments` ima jedno ime, i **nema** boolean kao `provides_assigned_workers`.

⚠️ Pogledaj i kako `departments` izvozi iz `index.ts` i kako se montira u aplikaciju — isto radiš i ti.

- [ ] **Korak 2: napiši Zod šeme u `@mr/shared`**

`packages/shared/src/schemas/intake-checklist-item.schema.ts`:

```ts
import { z } from 'zod'

/**
 * The code is what an intake order STORES (`checklist` is a `{code: DA/NE}` map), so it is the
 * stable identity and it is never edited after creation — changing it would orphan every order that
 * used it (spec ⑫/⑬). Names are editable and the rename is retroactive by design.
 */
export const INTAKE_CHECKLIST_CODE_MAX = 40
export const INTAKE_CHECKLIST_NAME_MAX = 80

export const IntakeChecklistItemCreateInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(INTAKE_CHECKLIST_CODE_MAX)
    // Same alphabet the seeded codes use, so a code is safe as a jsonb key and readable in a diff.
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  nameSr: z.string().trim().min(1).max(INTAKE_CHECKLIST_NAME_MAX),
  // Required, not optional: the work order prints in both languages (V-7 ⑪), so an item without an
  // English name prints Serbian on the English sheet.
  nameEn: z.string().trim().min(1).max(INTAKE_CHECKLIST_NAME_MAX),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
})

export const IntakeChecklistItemUpdateInputSchema = IntakeChecklistItemCreateInputSchema.omit({
  code: true,
}).partial()

export const IntakeChecklistItemListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  nameSr: z.string(),
  nameEn: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type IntakeChecklistItemCreateInput = z.infer<typeof IntakeChecklistItemCreateInputSchema>
export type IntakeChecklistItemUpdateInput = z.infer<typeof IntakeChecklistItemUpdateInputSchema>
export type IntakeChecklistItemListItem = z.infer<typeof IntakeChecklistItemListItemSchema>
```

Izvezi iz `packages/shared/src/schemas/index.ts` po uzoru na susede.

- [ ] **Korak 3: napiši padajuće integracione testove**

⚠️ Nov integracioni paket **mora sam da poseje svoje uslove**, i **dozvole PRE rola** — inače FK 23503 kad drugi paket TRUNCATE-uje. Prepiši taj obrazac iz `apps/api/src/modules/departments/__tests__/`.

```ts
  it('lists seeded items in sort order, newest catalog first is NOT the order', async () => {
    const items = await service.list({ activeOnly: false }, adminActor)

    expect(items.map((item) => item.code)).toEqual([
      'rezervna', 'dizalica', 'komplet', 'saobracajna',
      'vozacka', 'prvaPomoc', 'prsluk', 'lanci',
    ])
  })

  it('creates an item, and refuses a duplicate code with a conflict', async () => {
    const created = await service.create(
      { code: 'patosnici', nameSr: 'Gumeni patosnici', nameEn: 'Rubber mats', sortOrder: 90 },
      adminActor,
      auditContext,
    )
    expect(created.code).toBe('patosnici')

    await expect(
      service.create(
        { code: 'patosnici', nameSr: 'Drugo ime', nameEn: 'Other name' },
        adminActor,
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('renames without touching the code, because orders store the code', async () => {
    const before = await service.list({ activeOnly: false }, adminActor)
    const spare = before.find((item) => item.code === 'rezervna')
    if (spare === undefined) {
      throw new Error('seed missing: rezervna')
    }

    const renamed = await service.update(
      spare.id,
      { nameSr: 'Rezervna guma (puna)' },
      adminActor,
      auditContext,
    )

    expect(renamed.nameSr).toBe('Rezervna guma (puna)')
    expect(renamed.code).toBe('rezervna')
  })

  it('hides a deactivated item from the picker but keeps it in the full list', async () => {
    const all = await service.list({ activeOnly: false }, adminActor)
    const chains = all.find((item) => item.code === 'lanci')
    if (chains === undefined) {
      throw new Error('seed missing: lanci')
    }
    await service.update(chains.id, { isActive: false }, adminActor, auditContext)

    const picker = await service.list({ activeOnly: true }, adminActor)
    const full = await service.list({ activeOnly: false }, adminActor)

    expect(picker.map((item) => item.code)).not.toContain('lanci')
    // The display path needs it: a signed order may hold this code (D3).
    expect(full.map((item) => item.code)).toContain('lanci')
  })

  it('soft-deletes rather than destroying, so a signed order keeps a readable name', async () => {
    const all = await service.list({ activeOnly: false }, adminActor)
    const chains = all.find((item) => item.code === 'lanci')
    if (chains === undefined) {
      throw new Error('seed missing: lanci')
    }

    await service.delete(chains.id, adminActor, auditContext)

    const rows = await ctx.db
      .select({ deletedAt: schema.intakeChecklistItems.deletedAt })
      .from(schema.intakeChecklistItems)
      .where(eq(schema.intakeChecklistItems.id, chains.id))
    expect(rows[0]?.deletedAt).not.toBeNull()
  })

  it('writes an audit row for every change', async () => {
    const created = await service.create(
      { code: 'kanister', nameSr: 'Kanister', nameEn: 'Jerry can' },
      adminActor,
      auditContext,
    )

    const rows = await ctx.db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, created.id))
    expect(rows.length).toBeGreaterThan(0)
  })
```

- [ ] **Korak 4: pokreni i potvrdi da PADAJU**

Run: `pnpm --filter api test -- intake-checklist-items --run`
Expected: FAIL — modula još nema.

- [ ] **Korak 5: napiši sedam fajlova modula**

Prepiši oblik `departments`. Specifično za ovaj:

- repozitorijum: `list({ activeOnly })` sortira `sortOrder` pa `code`; podrazumevano filtrira `deleted_at IS NULL`; `activeOnly` dodaje `is_active = true`.
- servis: `create` na duplikat `code` diže `ConflictError` (ne 500 iz baze); `update` **ne prima `code`**; `delete` je meko; svaka promena piše audit i emituje SSE sa `ResourceChangedKey.IntakeChecklistItems`.
- kontroler: tanak, bez baze. Rute: sve četiri pod `requirePermission('settings.intake_checklist.manage')`; `:id` se parsira Zodom.

- [ ] **Korak 6: query factory u `@mr/shared`**

U `packages/shared/src/queries/reference-data.ts`. Taj fajl ima svoj obrazac — par „query key + options", `ReferenceLookupFilters`, `normalizeReferenceLookupFilters`, `fetchAllReferencePages` (paginira sam), i `REFERENCE_STALE_MS`/`REFERENCE_GC_MS`. Prati ga tačno:

```ts
export function intakeChecklistItemsReferenceQueryKey(filters: ReferenceLookupFilters = {}) {
  return ['intake-checklist-items', 'reference', normalizeReferenceLookupFilters(filters)] as const
}

/**
 * `activeOnly: true` is the PICKER — the wizard offers only live items. `activeOnly: false` is the
 * DISPLAY path, and it must stay available: a signed order can hold the code of an item the shop has
 * since deactivated or removed, and that row still has to render with its name (plan D3). An order
 * is evidence; it must not lose a line.
 */
export function intakeChecklistItemsReferenceOptions(filters: ReferenceLookupFilters = {}) {
  const normalized = normalizeReferenceLookupFilters(filters)
  return queryOptions({
    queryKey: intakeChecklistItemsReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<IntakeChecklistItemListItem>('/api/intake-checklist-items', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}
```

⚠️ `fetchAllReferencePages` paginira, pa **ruta liste mora da vraća oblik `{ items, total, page, pageSize }`** kao ostali šifarnici (`.cursor/rules/07`), ne go niz. Proveri kako `departments` vraća i uradi isto — inače ovaj poziv tiho dobije nešto što ne ume da pročita.

- [ ] **Korak 7: veži u container i montiraj rute**

U `apps/api/src/core/container.ts` dodaj repo i servis po uzoru na `departmentsRepository`/`departmentsService` (:266-267, :411-412), i u tip kontejnera (:118-119). Montiraj rute tamo gde se montiraju ostali moduli.

- [ ] **Korak 8: pokreni i potvrdi da PROLAZE**

Run: `pnpm --filter api test -- intake-checklist-items --run`
Expected: PASS svih šest.

- [ ] **Korak 9: mutacije**

| Mutacija | Mora da obori |
|---|---|
| u repozitorijumu izbaci `is_active` filter iz `activeOnly` grane | „hides a deactivated item from the picker" |
| u repozitorijumu izbaci sortiranje po `sortOrder` | „lists seeded items in sort order" |
| u servisu pusti duplikat `code` do baze (skloni `ConflictError`) | „refuses a duplicate code" |
| u servisu zameni meko brisanje tvrdim | „soft-deletes rather than destroying" |

Svaku vrati posle merenja. Ako neka **ne obori ništa**, test ne pokriva liniju koju misliš — popravi test.

- [ ] **Korak 10: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/api packages/shared
git commit -m "feat(api): the intake checklist becomes a catalog the shop owns"
```

---

## Zadatak 2: admin ekran

**Files:**

- Create: `apps/admin-web/src/resources/intake-checklist.definition.ts`
- Create: `apps/admin-web/src/routes/_shell/settings/intake-checklist/index.tsx`
- Modify: navigacija admina (gde su ostali `settings/*` linkovi)
- Modify: `packages/i18n/src/messages/{sr,en}.json`
- Test: `apps/admin-web/src/resources/__tests__/` po uzoru na postojeće

**Interfaces:**

- Consumes: sve iz zadatka 1 — `IntakeChecklistItem*Schema`, `intakeChecklistItemsReferenceOptions`, `ResourceChangedKey.IntakeChecklistItems`, `/api/intake-checklist-items`.
- Produces: ekran na `/settings/intake-checklist`. Ništa se ne naslanja na njega.

- [ ] **Korak 1: pročitaj uzor**

Run: `cat apps/admin-web/src/resources/departments.definition.ts apps/admin-web/src/routes/_shell/settings/departments/index.tsx`
179 + 39 linija. Definicija je **deklarativna** — kolone, polja obrasca, natpisi. Ruta samo montira `ResourceListPage`.

- [ ] **Korak 2: dodaj natpise u OBA jezika**

`sr.json`:

```json
  "nav_intake_checklist": "Ček-lista prijema",
  "intake_checklist_admin_title": "Ček-lista prijema",
  "intake_checklist_admin_description": "Stavke koje radnik na prijemu obeležava sa DA ili NE. Nalog pamti kod stavke, pa se preimenovanje vidi i na starim nalozima.",
  "intake_checklist_field_code": "Kod",
  "intake_checklist_field_code_hint": "Ne menja se posle upisa — nalozi ga pamte.",
  "intake_checklist_field_name_sr": "Naziv (srpski)",
  "intake_checklist_field_name_en": "Naziv (engleski)",
  "intake_checklist_field_name_en_hint": "Obavezan — nalog se štampa i na engleskom.",
  "intake_checklist_field_sort_order": "Redosled",
  "intake_checklist_field_active": "U upotrebi",
```

`en.json`:

```json
  "nav_intake_checklist": "Intake checklist",
  "intake_checklist_admin_title": "Intake checklist",
  "intake_checklist_admin_description": "The items the receiving worker marks YES or NO. An order remembers the item's code, so a rename shows on older orders too.",
  "intake_checklist_field_code": "Code",
  "intake_checklist_field_code_hint": "Fixed once saved — orders remember it.",
  "intake_checklist_field_name_sr": "Name (Serbian)",
  "intake_checklist_field_name_en": "Name (English)",
  "intake_checklist_field_name_en_hint": "Required — the order also prints in English.",
  "intake_checklist_field_sort_order": "Sort order",
  "intake_checklist_field_active": "In use",
```

Run: `pnpm --filter @mr/i18n run compile`

- [ ] **Korak 3: napiši definiciju i rutu**

Definicija: `resourceKey: ResourceChangedKey.IntakeChecklistItems`, `apiBase: '/api/intake-checklist-items'`, kolone `code` (mono), `nameSr`, `nameEn`, `sortOrder`, `isActive` (Da/Ne bedž kao `departments`), polja obrasca po natpisima iz koraka 2.

⚠️ **`code` je polje SAMO na kreiranju.** Na izmeni je prikazano a nepromenjivo — odluka ⑫: nalog pamti kod, pa bi promena koda osirotila svaki nalog koji ga je koristio. Ako `ResourceDefinition` nema način da polje bude create-only, **stani i prijavi** kako susedi rešavaju istu potrebu, ne izmišljaj treći način.

- [ ] **Korak 4: dodaj link u navigaciju admina**

Pod istom grupom gde su ostali šifarnici, gated na `settings.intake_checklist.manage`.

- [ ] **Korak 5: napiši test definicije**

Po uzoru na `apps/admin-web/src/resources/__tests__/`. Minimum: kolone su one iz koraka 3; `code` se ne pojavljuje među izmenjivim poljima.

- [ ] **Korak 6: pokreni**

Run: `pnpm --filter admin-web test --run`
Expected: PASS.

- [ ] **Korak 7: mutacija**

Dodaj `code` u polja za izmenu → test iz koraka 5 mora da padne. Vrati.

- [ ] **Korak 8: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/admin-web packages/i18n
git commit -m "feat(admin): the shop's intake checklist gets its own screen"
```

---

## Zadatak 3: potrošači prelaze na katalog — dok je šema još zatvorena

⚠️⚠️ **Zašto ovaj zadatak ide PRE otvaranja šeme.** Katalog danas sadrži tačno onih osam kodova koje konstanta nosi (seed ih je posejao iz istog spiska), pa potrošači mogu da počnu da čitaju katalog **bez ijedne vidljive promene ponašanja** i sa zelenim gejtom. Da je šema otvorena prva, `IntakeChecklist` bi prestao da bude zatvoren objekat i **svih šest čitalaca bi popucalo na tipu odjednom** — isto što je H platio i zbog čega mu je red preokrenut.

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/intake-checklist-catalog.ts` + njegov test
- Modify: `wizard/intake-checklist-grid.tsx`, `wizard/step-checklist.tsx`, `wizard/intake-wizard-state.ts`, `detail/card-condition.tsx`, `print/intake-print-data.ts`, `print/intake-print-condition.tsx`, `print/intake-print-dialog.tsx`, `intake-labels.ts`
- Modify: rute koje montiraju čarobnjak i detalj (prefetch kataloga u loaderu)
- Modify: `packages/i18n/src/messages/{sr,en}.json` (prazno stanje; osam naziva odlazi)
- Test: postojeći paketi tih fajlova

**Interfaces:**

- Consumes: `intakeChecklistItemsReferenceOptions` i `IntakeChecklistItemListItem` iz zadatka 1.
- Produces: `resolveIntakeChecklistRows(...)` i `countConfirmed(checklist, codes)` — zadatak 4 ih koristi nepromenjene.

- [ ] **Korak 1: napiši padajući test za jedno mesto koje spaja kodove i imena**

`intake-checklist-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { resolveIntakeChecklistRows } from '../intake-checklist-catalog'

const catalog = [
  { id: 'a', code: 'rezervna', nameSr: 'Rezervna guma', nameEn: 'Spare tyre', sortOrder: 10, isActive: true },
  { id: 'b', code: 'lanci', nameSr: 'Lanci / alat', nameEn: 'Chains / tools', sortOrder: 80, isActive: false },
]

describe('resolveIntakeChecklistRows', () => {
  it('renders the ORDER\'s own keys, not what the catalog offers today', () => {
    // The order recorded two rows. A ninth item added to the catalog since must not appear here,
    // or an old "3 / 8" silently becomes "3 / 9" for a document the customer already signed (D4).
    const rows = resolveIntakeChecklistRows({ rezervna: true, lanci: null }, catalog, 'sr')

    expect(rows.map((row) => row.code)).toEqual(['rezervna', 'lanci'])
  })

  it('keeps a deactivated item readable, because a signed order holds its code', () => {
    const rows = resolveIntakeChecklistRows({ lanci: false }, catalog, 'sr')

    expect(rows[0]?.name).toBe('Lanci / alat')
  })

  it('falls back to the bare code when the catalog has no row at all', () => {
    // Never drop the row: it is a line the customer signed for (D3).
    const rows = resolveIntakeChecklistRows({ nepoznato: true }, catalog, 'sr')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('nepoznato')
  })

  it('picks the English name for the English sheet', () => {
    const rows = resolveIntakeChecklistRows({ rezervna: true }, catalog, 'en')

    expect(rows[0]?.name).toBe('Spare tyre')
  })

  it('orders rows by the catalog sort order, with unknown codes last', () => {
    const rows = resolveIntakeChecklistRows({ zzz: true, lanci: null, rezervna: false }, catalog, 'sr')

    expect(rows.map((row) => row.code)).toEqual(['rezervna', 'lanci', 'zzz'])
  })
})
```

- [ ] **Korak 2: pokreni i potvrdi da PADA**

Run: `pnpm --filter internal-web test -- intake-checklist-catalog --run`
Expected: FAIL — modula nema.

- [ ] **Korak 3: napiši taj modul**

```ts
import type { IntakeChecklist, IntakeChecklistItemListItem } from '@mr/shared'

export interface IntakeChecklistRow {
  code: string
  name: string
  value: boolean | null
}

/**
 * Joins what an order RECORDED (a `{code: DA/NE}` map) with the names the catalog carries now.
 *
 * Two rules, both because a work order is evidence:
 *  · the rows are the ORDER's keys, never the catalog's — a newly added item must not retroactively
 *    change the count on a document somebody signed;
 *  · a code with no catalog row still renders, with the bare code as its name, rather than
 *    disappearing. A vanished row is a line the customer agreed to that we can no longer show.
 */
export function resolveIntakeChecklistRows(
  checklist: IntakeChecklist,
  catalog: readonly IntakeChecklistItemListItem[],
  locale: 'sr' | 'en',
): IntakeChecklistRow[] {
  const byCode = new Map(catalog.map((item) => [item.code, item]))

  return Object.entries(checklist)
    .map(([code, value]) => {
      const item = byCode.get(code)
      return {
        code,
        name: item === undefined ? code : locale === 'en' ? item.nameEn : item.nameSr,
        value,
        // Unknown codes sort last: they have no place in the shop's own order.
        sortOrder: item?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map(({ code, name, value }) => ({ code, name, value }))
}
```

- [ ] **Korak 4: pokreni i potvrdi da PROLAZI**

Run: `pnpm --filter internal-web test -- intake-checklist-catalog --run`
Expected: PASS svih pet.

- [ ] **Korak 5: čarobnjak korak 2 crta katalog**

`intake-checklist-grid.tsx` prima `items: readonly IntakeChecklistItemListItem[]` umesto da uvozi konstantu; `countConfirmed(checklist, codes)` dobija drugi argument. `step-checklist.tsx` čita `intakeChecklistItemsReferenceOptions({ activeOnly: true })`, prosleđuje `total: items.length`, i **kad je katalog prazan prikazuje prazno stanje** sa natpisom (D5), ne praznu karticu. `intake-wizard-state.ts` gradi početnu mapu iz kataloga.

Natpis za prazno stanje, u oba jezika:

```json
  "intake_checklist_empty": "Ček-lista još nije podešena. Kancelarija je dodaje u administraciji, pod „Ček-lista prijema\"."
```

```json
  "intake_checklist_empty": "The checklist has not been set up yet. The office adds items under \"Intake checklist\" in administration."
```

⚠️ Prefetchuj katalog u loaderu rute čarobnjaka (`ensureQueryData`), po uzoru na ostale reference u tom loaderu — inače korak 2 blinka prazan pa se napuni.

- [ ] **Korak 6: detalj crta mapu naloga**

`card-condition.tsx` zove `resolveIntakeChecklistRows(order.checklist, items, 'sr')` sa `activeOnly: false`, i „neobeleženo" računa iz **redova naloga**, ne iz dužine kataloga.

- [ ] **Korak 7: štampa bira jezik iz kataloga**

`buildIntakePrintModel` dobija katalog kao argument i zove `resolveIntakeChecklistRows(order.checklist, items, locale)` — **više ne prevodi kroz `m.intake_checklist_*`**. `intake-print-dialog.tsx` dohvata katalog (`activeOnly: false`) i prosleđuje ga.

⚠️ **List nikad ne sme da zove `m.ključ()` golo** (V-7 ⑪) — a imena sada ionako dolaze iz baze, pa je ovo mesto gde ta zamka nestaje sama.

- [ ] **Korak 8: obriši `INTAKE_CHECKLIST_LABELS` i osam mrtvih natpisa**

`intake-labels.ts`: mapa odlazi. Pa za svaki od osam ključeva
(`intake_checklist_rezervna`, `_dizalica`, `_komplet`, `_saobracajna`, `_vozacka`, `_prva_pomoc`, `_prsluk`, `_lanci`) pokreni **grep po IMENU ključa, ne po pozivu** — `grep -rn "intake_checklist_rezervna" apps packages --include='*.ts' --include='*.tsx'`. Poziv-oblik promašuje ključeve navedene kao gole funkcije u tabelama tipa `Record<string, () => string>`. Nula pogodaka → briši iz oba jezika.

⚠️ **OSTAJU**: `intake_checklist_yes`, `intake_checklist_no`, `intake_checklist_confirmed` — to nisu nazivi stavki.

Pa `pnpm --filter @mr/i18n run compile`.

- [ ] **Korak 9a: napiši test da ukupan broj dolazi iz kataloga**

Ovo je greška koju je brauzer već našao jednom, u B („Korak 2 / 5" posle što je traka pokazivala
četiri), pa se ovde pina testom, ne pogledom. U paketu za `step-checklist`:

```tsx
it('the total comes from the catalog, not from a literal', async () => {
  // Nine items in the catalog must read "… / 9". A literal 8 survives every other test in this file.
  const items = Array.from({ length: 9 }, (_, index) => ({
    id: `id-${index}`,
    code: `code${index}`,
    nameSr: `Stavka ${index}`,
    nameEn: `Item ${index}`,
    sortOrder: index * 10,
    isActive: true,
  }))

  await renderStepChecklist({ items })

  expect(screen.getByText(/\/ 9/)).toBeInTheDocument()
})
```

⚠️ Kako se `step-checklist` montira u testu i kako mu se katalog ubacuje (prop ili mockovan query)
prepiši iz postojećeg paketa za taj korak — ne izmišljaj treći način montiranja.

- [ ] **Korak 9b: popravi testove koji su padali, obriši one koji dokazuju obrisano**

`__tests__/intake-labels.test.ts` je iterirao kroz `INTAKE_CHECKLIST_KEYS` proveravajući da svaki ima natpis — to ponašanje više ne postoji, pa taj test **odlazi**, ne prepravlja se.

Run: `pnpm --filter internal-web test -- intake --run`
Expected: PASS.

- [ ] **Korak 10: mutacije**

| Mutacija | Mora da obori |
|---|---|
| u `resolveIntakeChecklistRows` iteriraj katalog umesto `checklist` | „renders the ORDER's own keys" |
| skloni fallback na goli kod (izostavi red kad ga nema u katalogu) | „falls back to the bare code" |
| u `step-checklist.tsx` vrati `total` na literal `8` | „the total comes from the catalog, not from a literal" (test iz koraka 9a) |
| u štampi uvek biraj `nameSr` | „picks the English name" |

- [ ] **Korak 11: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/i18n
git commit -m "feat(intake): the checklist is read from the catalog, and an old order keeps the rows it recorded"
```

---

## Zadatak 4: šema se otvara, servis presuđuje

Sada, i samo sada, admin može da doda devetu stavku i ona radi od kraja do kraja.

**Files:**

- Modify: `packages/shared/src/schemas/intake-order.schema.ts` (`IntakeChecklistSchema`, `INTAKE_CHECKLIST_KEYS` odlazi)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (straža), `apps/api/src/core/container.ts` (injekcija)
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

**Interfaces:**

- Consumes: `IntakeChecklistItemsRepository` iz zadatka 1; `resolveIntakeChecklistRows` iz zadatka 3 (nepromenjen — već radi sa bilo kojim kodom).
- Produces: `IntakeChecklist = Record<string, boolean | null>`; `INTAKE_CHECKLIST_KEYS` više ne postoji.

- [ ] **Korak 1: napiši padajuće testove**

```ts
    it('accepts a checklist key the admin added to the catalog', async () => {
      const serviser = await floorActor()
      await checklistService.create(
        { code: 'patosnici', nameSr: 'Gumeni patosnici', nameEn: 'Rubber mats', sortOrder: 90 },
        adminActor,
        auditContext,
      )

      const created = await service.create(createInput(), actorContext(serviser.id))
      const updated = await service.update(
        created.id,
        { checklist: { rezervna: true, patosnici: false } },
        serviser,
        actorContext(serviser.id),
      )

      expect(updated.checklist['patosnici']).toBe(false)
    })

    it('refuses a checklist key that is not in the catalog', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      // Otherwise any caller writes whatever it likes into a document that is evidence (spec ⑭).
      await expect(
        service.update(
          created.id,
          { checklist: { izmisljeno: true } },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('still accepts a code whose catalog item was deactivated', async () => {
      const serviser = await floorActor()
      const all = await checklistService.list({ activeOnly: false }, adminActor)
      const chains = all.find((item) => item.code === 'lanci')
      if (chains === undefined) {
        throw new Error('seed missing: lanci')
      }
      await checklistService.update(chains.id, { isActive: false }, adminActor, auditContext)

      const created = await service.create(createInput(), actorContext(serviser.id))
      const updated = await service.update(
        created.id,
        { checklist: { lanci: true } },
        serviser,
        actorContext(serviser.id),
      )

      // Deactivated hides it from the PICKER; a correction to an order that already holds it must
      // still land (D3).
      expect(updated.checklist['lanci']).toBe(true)
    })
```

- [ ] **Korak 2: pokreni i potvrdi da PADAJU**

Run: `pnpm --filter api test -- intake-orders.integration --run`
Expected: FAIL — Zod danas odbija svaki ključ van osam.

- [ ] **Korak 3: otvori šemu**

U `packages/shared/src/schemas/intake-order.schema.ts` zameni blok `INTAKE_CHECKLIST_KEYS` + `IntakeChecklistSchema`:

```ts
/**
 * The checklist is an open map now: `{code: DA/NE/untouched}`, whose codes live in the
 * `intake_checklist_items` catalog the shop owns. The WIRE deliberately does not judge which codes
 * are allowed — the service does, against the catalog (spec ⑭) — because the set changes at runtime
 * and a schema cannot know it. The third state stays: `null` means nobody touched the row, which is
 * not the same as "missing", and this document is the evidence if a customer later disagrees.
 */
export const INTAKE_CHECKLIST_CODE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

export const IntakeChecklistSchema = z.record(
  z.string().trim().min(1).max(40).regex(INTAKE_CHECKLIST_CODE_PATTERN),
  z.boolean().nullable(),
  // A cap so a caller cannot write an unbounded map into a jsonb column; far above any real list.
)

export type IntakeChecklist = z.infer<typeof IntakeChecklistSchema>
```

⚠️ Zod 4 `z.record` traži i ključ-šemu i vrednost-šemu. Ako `.max()` na broj ključeva nije dostupan na `z.record` u ovoj verziji, dodaj `.refine` sa jasnom porukom i **napiši u izveštaju koji si oblik upotrebio** — ne ostavljaj mapu bez kape.

- [ ] **Korak 4: straža u servisu**

`IntakeOrdersService` dobija `IntakeChecklistItemsRepository` kroz konstruktor (i `container.ts` ga prosleđuje), pa u `update` i `create`:

```ts
  /**
   * The wire accepts any well-formed code; the catalog decides which ones exist. Read ONLY when the
   * patch carries a checklist — the wizard patches on every step and must not pay for a query it
   * does not need.
   *
   * Deactivated and soft-deleted items still pass: an order may already hold that code, and a
   * correction to such an order must not be refused because the shop retired the item since (D3).
   */
  private async assertChecklistCodesKnown(checklist: IntakeChecklist): Promise<void> {
    const codes = Object.keys(checklist)
    if (codes.length === 0) {
      return
    }

    const known = new Set((await this.checklistItems.listAllCodes()).map((row) => row.code))
    const unknown = codes.filter((code) => !known.has(code))

    if (unknown.length > 0) {
      throw new ValidationError(`Unknown checklist item: ${unknown.join(', ')}`)
    }
  }
```

Dodaj `listAllCodes()` u `IntakeChecklistItemsRepository` — vraća **sve** kodove, uključujući ugašene i meko obrisane (D3).

- [ ] **Korak 5: pokreni i potvrdi da PROLAZE**

Run: `pnpm --filter api test -- intake-orders.integration --run`
Expected: PASS sva tri, i svi postojeći.

- [ ] **Korak 6: `INTAKE_CHECKLIST_KEYS` više ne postoji — dokaži**

Run: `grep -rn "INTAKE_CHECKLIST_KEYS" apps packages --include='*.ts' --include='*.tsx' | grep -v dist/`
Expected: nula pogodaka. Ako ih ima, zadatak 3 nije završio posao — dovrši ga ovde i reci u izveštaju.

- [ ] **Korak 7: mutacije**

| Mutacija | Mora da obori |
|---|---|
| skloni poziv `assertChecklistCodesKnown` iz `update` | „refuses a checklist key that is not in the catalog" |
| u `listAllCodes` dodaj filter `is_active = true` | „still accepts a code whose catalog item was deactivated" |
| vrati `IntakeChecklistSchema` na zatvoren objekat sa osam ključeva | „accepts a checklist key the admin added" |

- [ ] **Korak 8: pun gejt i komit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps packages
git commit -m "feat(api): the checklist accepts any code the catalog knows, and the service is the judge"
```

---

## Posle plana

- [ ] **Prolaz kroz brauzer** (Nikolin Chrome, njegov `pnpm dev:all` — **ne pokretati svoj**): admin doda stavku „Gumeni patosnici" → čarobnjak korak 2 je pokazuje kao devetu, brojač piše „… / 9" · obeleži je pa završi prijem → detalj i odštampan list je nose · admin preimenuje „Rezervna guma" → **stari nalog odmah piše nov naziv** (odluka ⑫) · admin je ugasi → čarobnjak je više ne nudi, a **stari nalog je i dalje prikazuje** · prekidač EN na listu pokazuje engleske nazive iz kataloga.
- [ ] **Zapiši u dnevnik** `.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md` — nov blok sa stanjem grane i onim što su merenje i mutacije našli.
- [ ] **Za produkciju, kad dođe red:** `pnpm --filter @mr/db run db:seed` jednom posle deploya — inače su katalozi prazni i korak 2 prikazuje prazno stanje.
- [ ] **G1 odblokirava C** („+" stavke). G2 (tipovi oštećenja, nosi ton markera) i G3 (načini dolaska) idu po istom obrascu, svaki sa svojim planom.
