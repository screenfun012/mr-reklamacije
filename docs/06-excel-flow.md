# 06 — Excel Import and Export

The entire application is built around a single Excel file structure.
This document maps Excel sheets to database tables and specifies exact transformation rules.

## Source file analysis (from `SVE_REKLAMACIJE.XLSX`)

Sheets found and their roles:

| Sheet | Role | Rows | Action |
|---|---|---|---|
| `UKUPNO SA 19.01.2026.` | Master EMOTIVE table | 521 | Source for `emotive_claims` import |
| `EMOTIVE REKLAMACIJE` | Year-over-year statistics | 49 | Derived on export (not imported) |
| `REKLAMACIJE PO ZAPOSLENOM` | Per-employee statistics | 28 | Derived on export (not imported) |
| `DOMAĆE REKLAMACIJE ` | Domestic claims (pre-2026 format) | 54 | Source for `domace_claims` import |
| `DOMAĆE REKLAMACIJE 2026` | Domestic claims (new format) | 9 | Source for `domace_claims` import |
| `2026`, `2025`, `2024`, `2023`, `2022`, `2021`, `2019` | Year views | 4–192 | Skipped (subsets of `UKUPNO`) |

---

## EMOTIVE column mapping (UKUPNO sheet)

Excel columns to `emotive_claims` fields:

| Excel col | Excel header | DB field | Transform |
|---|---|---|---|
| A | N0 | `sequence_number` | integer; assigned by DB sequence on new inserts |
| B | WARRANTY REPORT | `warranty_report` | trim, preserve case |
| C | ENGINE TYPE | `engine_type_id` | lookup or create `engine_types` by code + manufacturer |
| D | DATE OF CLAIM | `date_of_claim` | parse; see date handling below |
| E | MR NUMBER | `mr_number` | trim, preserve |
| F | DATE OF FINISH | `date_of_finish` | parse |
| G | CLAIM NUMBER | `claim_number` | trim; may be empty |
| H | EMPLOYEE | `employee_id` | lookup or create `employees` by normalized_name |
| I | GRESKA | `emotive_claim_faults[]` | split by `,`; resolve each token to `employees`, `departments`, or `external_parties` |
| J | REMARKS | `source_id` | lookup in `claim_sources` by `name` |
| K | GODINA | *(derived)* | ignored on import; DB computes from `date_of_claim` |
| L | (Prihvaćeno/Odbijeno — new column) | `outcome` | `"Prihvaćeno" → accepted`, `"Odbijeno" → rejected`, empty → `archived` |

### Date handling

Dates in the file appear in THREE formats:
1. String `"DD.MM.YYYY."` with trailing dot (e.g. `"25.02.2025."`)
2. String `"M/D/YYYY"` US format (e.g. `"3/24/2026"`)
3. Excel serial (JavaScript `Date` when read by ExcelJS/pandas)

Resolver logic:

```ts
function parseExcelDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return excelSerialToDate(value)

  const str = String(value).trim().replace(/\.$/, '')

  // DD.MM.YYYY
  const m1 = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1])

  // DD/MM/YYYY or M/D/YYYY (ambiguous; prefer D.M.Y when first > 12)
  const m2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m2) {
    const a = +m2[1], b = +m2[2], y = +m2[3]
    // If file originated in US locale exports, M/D/Y. If a > 12, must be D/M/Y.
    if (a > 12) return new Date(y, b - 1, a)
    return new Date(y, a - 1, b)  // assume M/D/Y — matches 3/24/2026 pattern in source
  }

  // With localized date format like "9. 2. 2026."
  const m3 = str.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/)
  if (m3) return new Date(+m3[3], +m3[2] - 1, +m3[1])

  return null  // log and skip row
}
```

**On ambiguous dates, log a warning** and use best guess; admin reviews after import.

### Employee normalization

Source data has inconsistent spelling for the same person: diacritics vs ASCII, and Serbian **đ** written either as Unicode `đ`/`Đ` or as the ASCII digraph `dj`/`Dj`/`DJ`. The same physical employee must always resolve to one `employees` row.

We use **two functions** (both live in `packages/shared`):

| Function | Purpose | Output shape |
|---|---|---|
| `toAsciiDisplay` | Human-readable ASCII for UI, Excel export, PDFs | Preserves word casing patterns; Serbian **đ/Đ** → **`dj`/`Dj`/`DJ`** per rules below |
| `normalizeName` | Canonical **matching key** for DB `normalized_name`, import lookup, indexes | Single uppercase string; all đ/dj variants collapse to the same key |

#### `toAsciiDisplay` (display / export)

Serbian **đ** is not a single-letter transliteration like č/ć/š/ž. In ASCII it is the digraph **`dj`**, with casing:

- `đ` → `dj`
- `Đ` → `Dj` when it starts a word (or the usual title-case position); for **all-uppercase** input, `Đ` → `DJ` (so `ĐORĐE` → `DJORDJE`, `ĐUKIĆ` → `DJUKIC`).

Other diacritics (strip combining marks after NFD, or direct mapping):

- `ć` → `c`, `Ć` → `C`
- `č` → `c`, `Č` → `C`
- `š` → `s`, `Š` → `S`
- `ž` → `z`, `Ž` → `Z`

**Examples:**

- `Đorđe Đukić` → `Djordje Djukic`
- `ĐORĐE ĐUKIĆ` → `DJORDJE DJUKIC`
- `đorđe đukić` → `djordje djukic`
- `Milovanović` → `Milovanovic`

#### `normalizeName` (matching key)

Build the key used on `employees.normalized_name` (UNIQUE) so that every spelling variant below maps to **one** row:

1. Apply the **same transliteration as `toAsciiDisplay`** (đ → dj digraph with correct case; other letters as above).
2. **Collapse the digraph** everywhere it appears as ASCII after step 1: `dj` → `d`, `Dj` → `D`, `DJ` → `D` (single letter **đ** is represented as **d** in the key).
3. **Uppercase** the whole string.
4. **Collapse** internal whitespace to a single space and **trim**.

**Examples (all produce the same key):**

- `Đorđe Đukić` → `DORDE DUKIC`
- `Djordje Djukic` → `DORDE DUKIC`
- `Dorde Dukic` → `DORDE DUKIC`
- `ĐORĐE ĐUKIĆ` → `DORDE DUKIC`
- `Milovanović` / `MILOVANOVIĆ` → `MILOVANOVIC`
- `Stanisavljević` → `STANISAVLJEVIC`

Empty / whitespace-only strings follow the same edge rules as other utilities (trim; empty → empty or reject at call site).

Store original as `full_name`, matching key as `normalized_name` (UNIQUE index).

### GRESKA resolver

The `GRESKA` column can contain:
- An employee name (maps to `fault_type='employee'`)
- A department code (maps to `fault_type='department'`)
- An external party name (maps to `fault_type='external'`)
- Comma-separated combinations (`"Glave, Sklapanje"`)
- Literal `"?"` (treated as unknown; skip fault row but don't fail)
- Empty string (no fault attribution)

Resolution priority (first match wins):
1. Normalize the token with **`normalizeName()`** (same canonical key as `employees.normalized_name`; see Employee normalization above)
2. Check if matches an `employees.normalized_name`
3. Check if matches a `departments.code` (after mapping `"GLAVE" → "GLAVE"`, `"SKLAPANJE" → "SKLAPANJE"`, etc.)
4. Check if matches `departments.name_sr` normalized
5. Check if matches `external_parties.name` normalized
6. Otherwise, log warning and skip this fault token

Department aliases observed in data:
- `"Blokovi"` → dept `BLOKOVI`
- `"Glave"` → `GLAVE`
- `"Sklapanje"` → `SKLAPANJE`
- `"ODELENJE BLOKOVA"` → `BLOKOVI`
- `"ODELENJE GLAVA"` → `GLAVE`
- `"GRESKA PERIONICE/KONTROLE"` → this is ambiguous; map to `KONTROLA` and add note to fault
- `"KONTROLA"` → `KONTROLA`

External parties observed: `AMC`, `JENMAK`, `MOTUS`, `NEWPARTS`, `PROIZVODJAC - JENMAK` (normalize to `JENMAK`).

### REMARKS → claim_sources

Map values exactly as they appear in the file:

| REMARKS value | source.code | source.name |
|---|---|---|
| `APPROVED GREEN` | `APPROVED_GREEN` | `APPROVED GREEN` |
| `SELMAN` / `Selman` | `SELMAN` | `SELMAN` |
| `VITOBELLO` | `VITOBELLO` | `VITOBELLO` |
| `JONKER` | `JONKER` | `JONKER` |
| `HMT` | `HMT` | `HMT` |
| `HR STRANKA - GEO SUPPORT` | `HR_GEO_SUPPORT` | `HR STRANKA - GEO SUPPORT` |
| `HR STRANKA - MIROSLAV VUJIC` | `HR_MIROSLAV_VUJIC` | `HR STRANKA - MIROSLAV VUJIC` |
| `AUTO STANIC` / `AUTO STANIĆ` | `AUTO_STANIC` | `AUTO STANIC` |

Any unseen `REMARKS` value triggers a warning and creates a new `claim_sources`
row with auto-generated code (uppercased + underscored).

### Outcome mapping

| Excel value | DB outcome |
|---|---|
| `"Prihvaćeno"` / `"PRIHVACENO"` / `"Prihvaceno"` | `accepted` |
| `"Odbijeno"` / `"ODBIJENO"` | `rejected` |
| `"U obradi"` / `"U Obradi"` | `pending` |
| `""` / null (old rows) | `archived` |

### Customer inference for EMOTIVE

EMOTIVE claims don't have an explicit customer column in the old data.
The `REMARKS` / `source_id` implicitly indicates customer:
- `APPROVED GREEN` → `MR ENGINES` (default; our own warranties)
- `SELMAN` → `SELMAN`
- `VITOBELLO` → `VITOBELLO`
- `JONKER` → `JONKER`
- `HMT` → `HMT`

Fallback customer per source is stored in `claim_sources.default_customer_id` (see `docs/02-data-model.md`); admins can change it without a deploy.

For statistics that need per-customer breakdown (e.g., `MRT POLSKA` vs `MRT VEGHEL`),
those partners are tracked in `EMOTIVE REKLAMACIJE` stat sheet but not in the main
`UKUPNO` sheet. We store them **when available**; when an EMOTIVE claim's customer
is not determinable, we default to `MR ENGINES` (our own warranty flow).

---

## DOMACE column mapping

Both the old (pre-2026) and new (2026+) formats unify into `domace_claims`.
Missing columns in one format are set to NULL.

### Old format (`DOMAĆE REKLAMACIJE ` sheet)

| Excel col | Excel header | DB field | Transform |
|---|---|---|---|
| A | R.B. | `sequence_number_yearly` | integer; derived from year if missing |
| B | DATUM | `date_received` | parseExcelDate |
| C | IME STRANKE | `customer_name_snapshot` + `customer_id` | store snapshot; fuzzy-match to customers, create `domestic_company` or `domestic_individual` if new |
| D | VOZILO | `vehicle` | trim |
| E | RADNI NALOG | `work_order` | trim |
| F | STARI R/N | `old_work_order` | trim; split on whitespace keeps first only (data had `"103362/24 100073/25"`) → store as-is |
| G | IZNOS ORIGINALNOG RACUNA | `original_invoice_amount` | parse decimal; non-numeric (e.g. `"REKLAMACIJA NAS TROSAK"`) → null + note |
| H | BROJ RACUNA | `invoice_number` | trim |
| I | OPIS PROBLEMA | `problem_description` | trim |
| J | REKLAMACIJA | `outcome` | `"PRIHVACENA" → accepted`, `"ODBIJENA" → rejected`, empty → `archived` |
| K | IZNOS DELOVA BEZ PDV | `parts_amount_no_vat` | parse decimal; `"nema"` → null |
| L | IZNOS RADA BEZ PDV | `labor_amount_no_vat` | parse decimal |
| M | UKUPNO | `total_amount` | parse decimal |
| N | ZAPOSLENI | `assigned_employee_id` | normalize + lookup; multi-employee strings (e.g. `"MILOS I DEJAN SKLAPALI MOTOR"`) → parse primary, rest → `notes` |
| O | NAPOMENA | `notes` | trim |

### New format (`DOMAĆE REKLAMACIJE 2026` sheet)

| Excel col | Excel header | DB field | Transform |
|---|---|---|---|
| A | R. br. | `sequence_number_yearly` | |
| B | Datum prijema | `date_received` | |
| C | Ime stranke | `customer_name_snapshot` + `customer_id` | |
| D | Vozilo | `vehicle` | |
| E | Radni nalog | `work_order` | |
| F | Stari radni nalog | `old_work_order` | |
| G | Iznos originalnog računa | `original_invoice_amount` | |
| H | Broj računa | `invoice_number` | |
| I | Razlog reklamacije | `problem_description` | |
| J | Status | `outcome` | `"U Obradi" → pending`, `"Prihvaćeno" → accepted`, `"Odbijeno" → rejected` |
| K | Iznos delova bez PDV | `parts_amount_no_vat` | |
| L | Ukupno | `total_amount` | `labor_amount_no_vat` = `total - parts_amount` when both present |
| M | Zaduženi radnik (Ko je radio motor) | `assigned_employee_id` | |
| N | Odeljenje greške | `fault_department_id` | lookup by normalized name_sr |

---

## Import flow (one-time legacy ETL)

Admin UI: `/admin/import/legacy-excel` page.

1. Admin uploads `.xlsx` file
2. Server stores file temporarily in `/tmp/etl-<uuid>.xlsx`
3. Server parses and produces a **dry-run report** without writing anything:
   - Counts per sheet
   - Detected new entities (employees, customers, engine types, fault parties)
   - Rows that will fail (parse errors) with details
   - Rows that will be created vs. updated vs. skipped
4. Admin reviews report in UI (collapsible sections), can:
   - Approve → runs actual import in a single transaction
   - Cancel → aborts
5. On approval, import runs in background job; progress streamed via SSE
6. On completion, result stored; admin can re-download the dry-run report + actual log

Idempotency: each claim imported has a computed `import_key` (SHA256 of
`mr_number + date_of_claim + employee normalized_name + warranty_report first 100 chars`)
stored in a temporary table during import. Re-running the import detects
existing keys and skips or updates based on admin's "overwrite" toggle.

### ETL transactional boundaries

- All inserts for one workbook happen in one transaction — all or nothing
- If the transaction fails, no partial data remains
- Audit log entry written for the entire import operation

### ETL file location

`scripts/etl-legacy-excel.ts` — standalone script, importable by the API route
that handles admin-initiated imports. Also runnable from CLI for developer use:

```bash
pnpm etl:legacy path/to/SVE_REKLAMACIJE.XLSX --dry-run
pnpm etl:legacy path/to/SVE_REKLAMACIJE.XLSX --commit
```

---

## Export flow

Admin/operator clicks "Export Excel" button → options dialog:

### Export options

- **Full workbook** — all sheets, identical structure to source file
- **Partial by market** — only EMOTIVE or only DOMACE
- **Partial by year** — one year's sheet plus its corresponding rows in UKUPNO
- **Partial by customer** — filter UKUPNO and DOMACE to specific customer
- **Partial by date range** — `from` → `to`
- **Current view** — export exactly what the user sees in the current filtered list

Selection persists in `app_settings` as user preferences.

### Output filename

```
reklamacije-<date>-<scope>.xlsx
```

Examples:
- `reklamacije-2026-04-17-full.xlsx`
- `reklamacije-2026-04-17-emotive-2025.xlsx`
- `reklamacije-2026-04-17-domace-mr-group.xlsx`

### Sheet generation

#### `UKUPNO SA DD.MM.YYYY.` sheet

- Header row: identical to source (`N0 | WARRANTY REPORT | ENGINE TYPE | DATE OF CLAIM | MR NUMBER | DATE OF FINISH | CLAIM NUMBER | EMPLOYEE | GRESKA | REMARKS | GODINA | (outcome)`)
- Today's date appended in sheet name
- Rows: ordered by `sequence_number` ASC
- Outcome column renders as `Prihvaćeno`, `Odbijeno`, empty for `archived`

#### Year sheets (`2026`, `2025`, ...)

- One per distinct `claim_year` in the dataset
- Same header structure as `UKUPNO`
- Rows: `emotive_claims WHERE claim_year = N` ordered by date_of_claim

**Year sheets are generated dynamically.** Adding a claim in a year that
didn't exist before automatically creates that sheet on the next export.

#### `EMOTIVE REKLAMACIJE` (statistics sheet)

Three sections stacked vertically, matching source layout:

**Section 1:** per-customer counts for each year (2024, 2025, 2026).
Header: `NAZIV FIRME | PRIHVAĆENO | ODBIJENO | TOTAL`
One block per year, separated by empty row.

**Section 2:** per-employee counts accepted, one block per year.
Header: `ZAPOSLENI | UKUPAN BROJ`

**Section 3:** (for current year) same as section 1 but with current cutoff date.

Computed from the data at export time (not stored).

#### `REKLAMACIJE PO ZAPOSLENOM` sheet

Three columns of blocks side by side (one per year):

For each year:
```
IME RADNIKA | SKLOPLJENO U YYYY | BROJ REKLAMACIJA | PROCENAT
```

- `SKLOPLJENO U YYYY` — sum from `employee_monthly_output` for that year
- `BROJ REKLAMACIJA` — count from `emotive_claims` where `employee_id = ? AND claim_year = ?`
- `PROCENAT` — `BROJ REKLAMACIJA / SKLOPLJENO` formatted as `X.XX%`

Below the per-employee block, the sheet contains department-level totals:
```
BLOKOVI | (count of faults attributed to dept)
GLAVE | ...
KLIPNJAČE | ...
...
UKUPNO | (sum)
```

#### `DOMAĆE REKLAMACIJE ` sheet (old format)

Header: identical to source.
Rows: `domace_claims WHERE claim_year <= 2025 OR (claim_year = 2026 AND <was imported from old format>)`.
For simplicity: all DOMACE claims from **pre-2026** go here.

#### `DOMAĆE REKLAMACIJE 2026` sheet (new format)

Rows: `domace_claims WHERE claim_year >= 2026`.

#### Additional year sheets for DOMACE (future)

For 2027, 2028, ... we generate a `DOMAĆE REKLAMACIJE YYYY` sheet per year with the new format.

### Styling

Match source file styling as closely as possible:
- Font: `Calibri` 11pt default
- Header rows: bold, background `#C5D9F1` (or whatever the source uses — extract from template)
- Borders: thin all around
- Column widths: optimized by content
- Date cells: `DD.MM.YYYY.` format
- Money cells: `#,##0.00` format, no currency symbol in cell (header indicates unit)
- Percentages: `0.00%`

Implementation uses a **template workbook** stored at `packages/excel/templates/reklamacije-template.xlsx`
with pre-styled sheets. ExcelJS loads the template, clones the styled rows, and
populates data. This preserves exact styling without replicating it in code.

### Template maintenance

- The template file is committed to git
- To adjust styling, edit the template in Excel/LibreOffice and commit
- Never hard-code colors or fonts in exporter code; always reference template cells

### Formula handling

Source file has minimal formulas. Our export includes:
- Year sheet: no formulas (direct values)
- Stats sheet: formulas for TOTAL column (`=B4+C4`), UKUPNO row (`=SUM(...)`), percentages

Use `workbook.calcProperties.fullCalcOnLoad = true` to force recalc when opened.

### Export performance

For the expected data size (< 10k rows total), full export takes < 5 seconds.
Streamed to client as download; no background job needed in MVP.

If file grows beyond 50k rows in future, convert to background job:
- POST returns `{ jobId }` immediately
- Worker generates file in background
- SSE `export_ready` event fires with download URL
- Files auto-deleted after 1 hour

---

## Edge cases and error handling

### EMOTIVE

- **Missing `mr_number`:** the column `mr_number` stays `NOT NULL` in the database. For legacy Excel rows with an empty MR number, the ETL assigns a placeholder `LEGACY-<sequence_number>` (e.g. `LEGACY-147`), using the same `sequence_number` as the imported row. New claims entered in the app must always have a real MR number; placeholders exist only to preserve historical import rows.
- **Missing `claim_number`:** allowed; common for internal claims
- **Missing `date_of_claim`:** row skipped with warning — can't compute year
- **Invalid employee name:** skip row, log warning, admin reviews
- **Unknown engine code:** create new `engine_types` entry with `manufacturer = null`
- **Unknown source (REMARKS):** create new `claim_sources` with generated code

### DOMACE

- **Walk-in customer (one-time):** `customer_id = null`, `customer_name_snapshot` populated
- **Missing amounts:** all three amount fields allowed null
- **Missing employee:** allowed (some rows have no assignee in old data)
- **`"nema"` as amount:** → null
- **`"REKLAMACIJA"` / `"REKLAMACIJA NAS TROSAK"` as amount:** → null + note in `notes`

### Dry-run report sections

```
Import preview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ EMOTIVE claims:       512 to insert, 0 to update, 9 will skip
✓ DOMACE claims:         59 to insert, 0 to update, 4 will skip
✓ New employees:         23
✓ New engine types:      18
✓ New customers:         12
✓ New external parties:   3
✓ New claim sources:      1 (AUTO_STANIC — matches existing when normalized)

⚠ Warnings: 14
  - Row UKUPNO!458: ambiguous date "1/21/2026", interpreted as 2026-01-21
  - Row UKUPNO!512: GRESKA value "?" — no fault attribution
  - Row DOMACE!30: invoice amount "REKLAMACIJA" — stored as NULL with note
  ...

✗ Errors: 0

Run import? [Cancel] [Approve]
```

### Concurrency

- Import runs in a single transaction; other users see no partial data
- While import is running, Admin UI shows banner "Import in progress — 45%"
- Other mutations by operators are allowed (they won't conflict; imports don't touch modern claims)
