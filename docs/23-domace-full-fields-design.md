# docs/23 — DOMAĆE reklamacije: full field set to match the business Excel

> **Status: DESIGN, approved-direction (2026-07-23).** Written with Nikola after parsing the
> real `Domaće reklamacije.xlsx` (15 columns) and running a grounded gap analysis across the
> whole DOMACE vertical (db, shared, form, api, excel). Implementation NOT started — build only
> on Nikola's per-phase go. Migration (M-0) needs explicit approval and a clean migrate-from-zero.

---

## 1. Why

The real business sheet a DOMACE claim is tracked on has **15 columns**. The app captures only
part of them, some are mapped inconsistently, and the DOMACE Excel export emits 9 of the 15. This
brings the model and the export up to the full sheet, and — Nikola's explicit requirement —
**renames the in-app field labels to match the sheet so the workers are not confused.**

Source document columns (with sample data), verbatim:

| Col | Header | Meaning | Sample |
| --- | --- | --- | --- |
| A | R. B. | sequence | 1, 2, 3 |
| B | DATUM | date | 7/9/2026 |
| C | IME STRANKE | customer/client, free text | Drnda Internacional, Nemanja Nešović |
| D | VOZILO | vehicle/engine, free text | Mercedes 651, BMW N57, Fiat 1.3 mjtd |
| E | RADNI NALOG | current work order | 101311/26 |
| F | STARI R/N | old work order | Stari r.n. 102192/25 |
| G | IZNOS ORIGINALNOG RAČUNA | original invoice amount | 4, 10, 18, 30 |
| H | BROJ RAČUNA | invoice number | (empty in samples) |
| I | OPIS PROBLEMA | problem description | Gura ulje u vodu, Pregravanje |
| J | REKLAMACIJA | outcome | Odbijeno / U Obradi / Prihvaćeno |
| K | IZNOS DELOVA BEZ PDV | parts amount ex-VAT | 4, 29 |
| L | IZNOS RADA BEZ PDV | labor amount ex-VAT | (empty) |
| M | UKUPNO | total | (empty) |
| N | ZAPOSLENI | employee | (empty) |
| O | NAPOMENA | note | (empty) |

---

## 2. Decisions (locked with Nikola)

1. **Money = full breakdown.** New fields: original-invoice amount, parts amount, labor amount.
   **UKUPNO = parts + labor, ex-VAT (a plain sum, no VAT term).** `total_amount` stays as the
   stored column but is COMPUTED = parts + labor on write (so statistics/dashboard that already
   read `total_amount` keep working unchanged).
2. **Amounts are editable in any outcome state** — not only when `accepted`. The Excel carries
   amounts on pending/rejected rows. → the accepted-only gate is removed for DOMACE money.
3. **VOZILO stays the catalog structure** (manufacturer + engine type + engine code). No new
   `vehicle` column; the export COMPOSES a VOZILO string from the three fields.
4. **STARI R/N (F) = the existing `claim_number` field** — that is where the crew already writes
   the old work order. No new column; the field is **relabelled to "Stari radni nalog"** in the UI.
5. **BROJ RAČUNA (H) = a new `invoice_number` field.** The export today mislabels `claim_number`
   as BROJ RAČUNA; that stops.
6. **OPIS PROBLEMA (I) = `warranty_report`** (labelled "Razlog" today) — unchanged source,
   relabelled to "Opis problema".
7. **NAPOMENA (O) = the claim's findings (nalazi), composed into one cell** as
   `text (type); text (type)`. ⚠️ **This REVERSES the earlier invariant** "Excel must NOT export
   findings / findings→NAPOMENA was rejected" (CLAUDE.md §9 / [[internal-web-backlog-2026-07-21]] #4).
   Reversed deliberately with Nikola on 2026-07-23: DOMACE has no portal, so the client-leak reason
   is moot, and only the Excel rule remained. Update that invariant when this ships.
8. **ZAPOSLENI (N) = any active employee, via a searchable typeahead** (type the name, it filters)
   — for DOMACE only. Today the picker is limited to assembly-department workers; widen it and make
   it searchable so the crew stops scrolling the whole list.
9. **In-app labels are aligned to the sheet** (see §5) so the form reads like the paper. Nikola's
   general rule: **every DOMACE field label matches its Excel column name** — the one explicit
   exception is DATUM, which stays "Datum prijema".

---

## 3. Full column mapping (end state)

| Excel | Source field | New? | Note |
| --- | --- | --- | --- |
| A R.B. | `sequence_number` | | global counter (kept; not per-year restart) |
| B DATUM | `date_of_claim` | | "Datum prijema" → label "Datum" |
| C IME STRANKE | `customer_name` | | free text (no customer FK) |
| D VOZILO | `manufacturer` + `engine_type` + `engine_code` | | composed string for export |
| E RADNI NALOG | `mr_number` | | already correct in export |
| F STARI R/N | `claim_number` | | existing field, relabel "Stari radni nalog"; export moves it from BROJ RAČUNA → STARI R/N |
| G IZNOS ORIG. RAČUNA | `original_invoice_amount` | ✅ | decimal(14,2) |
| H BROJ RAČUNA | `invoice_number` | ✅ | text |
| I OPIS PROBLEMA | `warranty_report` | | relabel "Opis problema" |
| J REKLAMACIJA | `outcome` | | rejected=Odbijeno, pending=U Obradi, accepted=Prihvaćeno; `archived` has no sheet equivalent |
| K IZNOS DELOVA BEZ PDV | `parts_amount` | ✅ | decimal(14,2) |
| L IZNOS RADA BEZ PDV | `labor_amount` | ✅ | decimal(14,2) |
| M UKUPNO | `total_amount` = parts + labor | | computed on write |
| N ZAPOSLENI | `employee_id` | | widen to all active + searchable |
| O NAPOMENA | `findings` composed | | reverses the no-findings-in-Excel rule |

**MR NUMBER** (`mr_number`) is the RADNI NALOG (E) and also the duplicate-check key — it stays.
There is no separate MR NUMBER column on this sheet, which is correct: E already carries it.

---

## 4. Schema — one migration, all nullable

`domace_claims` gains four columns (drizzle-kit generated, never hand-written; existing rows NULL,
no backfill):

- `original_invoice_amount numeric(14,2)` — G
- `invoice_number text` — H
- `parts_amount numeric(14,2)` — K
- `labor_amount numeric(14,2)` — L

No new column for D (VOZILO composed), F (STARI R/N = existing `claim_number`), M (`total_amount`
kept), or O (`findings` kept). `domace_claim_faults` untouched. Text/CHECK convention unchanged; no
PG enum. Prove clean migrate-from-zero on an empty `_test` DB before applying.

If the new text fields must be searchable in the claims list later, the `idx_domace_claims_search_fts`
GIN expression and the repository's textually-identical search expression must change together — a
separate follow-up migration, out of scope here unless Nikola asks.

---

## 5. Label alignment (app ↔ sheet)

The workers read the paper sheet; the form must use the same words. i18n changes (`sr.json` +
`en.json` parity), DOMACE only:

| Field | Current label | New label (matches sheet) |
| --- | --- | --- |
| `mr_number` | "Naš broj / radni nalog" | **Radni nalog** |
| `claim_number` | "Broj klijenta / radni nalog klijenta" | **Stari radni nalog** |
| `customer_name` | "Kupac" | **Ime stranke** |
| `warranty_report` | "Razlog" | **Opis problema** |
| `date_of_claim` | "Datum prijema" | **Datum prijema** (kept — Nikola's explicit exception) |
| `original_invoice_amount` | — | **Iznos originalnog računa** |
| `invoice_number` | — | **Broj računa** |
| `parts_amount` | — | **Iznos delova bez PDV** |
| `labor_amount` | — | **Iznos rada bez PDV** |
| `total_amount` | (existing) | **Ukupno** |
| `employee_id` | (assigned worker) | **Zaposleni** |
| findings section | "Nalazi" | **Napomena** (DOMACE only; EMOTIVE keeps "Nalazi") |

The findings SECTION on the DOMACE detail/create is relabelled **"Napomena"** to match Excel column
O — DOMACE only; EMOTIVE keeps "Nalazi". The data is unchanged (still the structured findings
`{text, type}` rows); only the section heading and the Excel column differ.

**VOZILO (D)** has no single field — the form keeps the three catalog inputs (Proizvođač, Tip
motora, Šifra motora); group them under a **"Vozilo"** heading so the worker connects them to the
sheet's VOZILO column. The export composes the VOZILO string from the three.

---

## 6. Money model detail

- Three amount inputs: original invoice (G), parts ex-VAT (K), labor ex-VAT (L). All nullable,
  decimal(14,2), all editable in any outcome state.
- **UKUPNO (M) = parts + labor**, computed. `total_amount` remains the stored column and is set =
  `parts_amount + labor_amount` (treating NULL as 0) on every create/update, so downstream readers
  (statistics `domaceAmounts`, dashboard) are unaffected. `total_amount` is no longer a manual input.
- The accepted-only editability guard (`assertAcceptedClaimAmountEditable`, `core/claims/claim-lock.ts`,
  called in `domace-claims.service.ts`) is **retired** — removed from the DOMACE amount path and the
  file deleted if it has no other caller (Nikola: "ne aktiviram"). Amounts are editable in any state.

---

## 7. Excel export changes

DOMACE sheet goes from 9 → 15 columns. `DOMACE_HEADERS` and `domaceRowValues`
(`packages/excel/src/build-reklamacije-workbook.ts`), the `DomaceExportRow` shape
(`apps/api/src/modules/excel/excel.service.ts`), and `listDomaceForExport`
(`excel.repository.ts`) all change:

- Add columns: VOZILO (composed), STARI R/N, IZNOS ORIGINALNOG RAČUNA, IZNOS DELOVA BEZ PDV,
  IZNOS RADA BEZ PDV, and re-add NAPOMENA (findings, composed). Final DOMACE header order to match
  the sheet A–O exactly.
- Fix the crossed mapping: RADNI NALOG stays `mr_number`; STARI R/N = `claim_number` (was going to
  BROJ RAČUNA); BROJ RAČUNA = `invoice_number`.
- NAPOMENA was dropped in commit `b417289`; its regression test asserting the DOMACE headers
  `.not.toContain('NAPOMENA')` must be updated to assert it IS present.
- UKUPNO now reflects parts+labor via the computed `total_amount`.
- Decide whether the new DOMACE fields also surface on the UKUPNO/GODINA master sheets (which remap
  DOMACE rows into the EMOTIVE 11-column layout via `mapDomaceToEmotiveRow`, and today drop
  `total_amount`). Default: leave master sheets as-is; the new detail belongs on the DOMACE sheet.
- Excel package coverage gate is 95% — new fixtures/assertions required.

---

## 8. Out of scope / unaffected

- **Portal: zero impact.** The client portal is EMOTIVE-only; DOMACE has no customer FK / no
  `customer_users` link, so no client-visibility, masking, freshness, or client-summary work.
- **EMOTIVE untouched.** Every change is DOMACE-only (schema columns, form, export DOMACE sheet).
- Statistics/dashboard: unaffected because `total_amount` keeps holding the total (now computed).

---

## 9. Confirmations — RESOLVED (2026-07-23)

1. DATUM label — **kept "Datum prijema"** (Nikola's explicit exception to the match-the-sheet rule).
2. Findings section label — **renamed "Napomena"** in-app, DOMACE only.
3. NAPOMENA compose format — **`text (type); text (type)`** per finding, semicolon-separated. Confirmed.
4. `claim-lock.ts` amount guard — **retired** (amounts editable in any state).

No open questions remain; the design is ready to build phase by phase.

---

## 10. Phased build order (each starts only on Nikola's go)

- **M-0 — Migration** (explicit approval): add the 4 nullable columns to `domace_claims`.
  Verify journal → drizzle-kit generate → clean migrate-from-zero on empty `_test` → show SQL → apply.
- **M-1 — Shared + API**: extend the DOMACE create/update/detail Zod schemas and the
  repository/service with the new fields; compute `total_amount = parts + labor`; drop the
  accepted-only amount gate; keep audit coverage.
- **M-2 — Form + labels**: add the 5 inputs (stari radni nalog is the relabelled existing field,
  broj računa, 3 amounts) to the DOMACE create + edit forms; align all labels (§5); make ZAPOSLENI a
  searchable all-employees select (reuse the existing searchable-select pattern); show UKUPNO as a
  live parts+labor sum.
- **M-3 — Excel export**: DOMACE sheet to the full 15 columns in sheet order, VOZILO composed,
  NAPOMENA from findings, crossed mapping fixed; update the removed-NAPOMENA regression test.

Full gate green before each commit; Nikola pushes.
