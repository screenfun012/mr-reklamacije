# 02 — Data Model

All tables use `snake_case` identifiers. All primary keys are UUID v7 (time-ordered).
All timestamps are `timestamptz` (UTC). All monetary amounts are `decimal(14,2)`
(fits 999,999,999,999.99 RSD — far more than needed).

Conventions:
- `created_at`, `updated_at`, `deleted_at` (soft delete) on every business table
- `created_by`, `updated_by` reference `users.id` (nullable for system-created)
- `deleted_at IS NULL` is the default filter in every repository method

---

## Auth tables (managed by Better-Auth)

### `users`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | citext UNIQUE | case-insensitive |
| email_verified | boolean | default false |
| name | text | full name |
| image | text NULL | avatar URL |
| is_active | boolean | default true; deactivate instead of delete |
| preferred_language | text | default 'sr'; values: 'sr' \| 'en' |
| two_factor_enabled | boolean | default false |
| last_login_at | timestamptz NULL | |
| last_login_ip | inet NULL | |
| created_at, updated_at | timestamptz | |

### `sessions`

Better-Auth managed; key columns:
- id, user_id (FK), token, expires_at, ip_address, user_agent, created_at

### `accounts`

Better-Auth managed; used for credential storage and future OAuth providers.

### `verification_tokens`

Better-Auth managed; email verification, password reset, magic links.

### `two_factor_secrets`

Better-Auth managed (TOTP plugin): user_id, secret, backup_codes.

---

## RBAC tables

### `permissions` (seeded from code, immutable at runtime)

| Column | Type | Notes |
|---|---|---|
| id | text PK | dot-notation code, e.g. `emotive_claims.create` |
| module | text | e.g. `emotive_claims` |
| action | text | e.g. `create` |
| name_sr | text | localized display name |
| name_en | text | |
| description_sr | text | |
| description_en | text | |

Seeded at app startup from `packages/shared/permissions.ts`. Never written
at runtime. Full list in `docs/03-permissions.md`.

### `roles`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | e.g. `admin`, `operator`, `viewer`, `client`, or custom like `senior_operator` |
| name_sr | text | |
| name_en | text | |
| description | text NULL | |
| is_system | boolean | default false; system roles (`admin`, `operator`, `viewer`, `client`) cannot be deleted or renamed |
| created_at, updated_at, created_by, updated_by | | |

### `role_permissions` (M:N)

| Column | Type | Notes |
|---|---|---|
| role_id | uuid FK roles | |
| permission_id | text FK permissions | |

PK: (role_id, permission_id)

### `user_roles` (M:N)

| Column | Type | Notes |
|---|---|---|
| user_id | uuid FK users | |
| role_id | uuid FK roles | |
| assigned_at | timestamptz | |
| assigned_by | uuid FK users | |

PK: (user_id, role_id)

### `client_registration_requests`

For client self-registration flow; admin reviews before approval.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | citext | |
| name | text | |
| phone | text NULL | |
| company_name | text NULL | |
| message | text NULL | applicant's note to admin |
| preferred_language | text | 'sr' \| 'en' |
| password_hash | text | hashed upfront; account inactive until approved |
| status | text | 'pending' \| 'approved' \| 'rejected' \| 'needs_info' |
| admin_note | text NULL | |
| linked_customer_id | uuid NULL FK customers | set on approval |
| created_user_id | uuid NULL FK users | set on approval |
| created_at | timestamptz | |
| reviewed_at | timestamptz NULL | |
| reviewed_by | uuid NULL FK users | |

---

## Organization tables

### `employees`

People who assemble engines. Separate from `users` (not every employee uses the app).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| full_name | text | e.g. "IVICA STANISAVLJEVIĆ" |
| normalized_name | text UNIQUE | uppercase, no diacritics, used for Excel import matching |
| user_id | uuid NULL FK users | if this employee uses the app |
| hire_date | date NULL | |
| terminated_at | date NULL | |
| is_active | boolean | default true |
| notes | text NULL | |
| created_at, updated_at, deleted_at | | |

**Normalization function** (used at insert and for imports):

```ts
// e.g. "Ivica Stanisavljević" → "IVICA STANISAVLJEVIC"
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[đĐ]/g, m => m === 'đ' ? 'D' : 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}
```

### `departments`

Departments responsible for specific error categories.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | e.g. `BLOKOVI`, `GLAVE`, `SKLAPANJE`, `KONTROLA`, `MAGACIN`, `RADILICE`, `RASKLAPANJE`, `ZAVRSNA_KONTROLA`, `KLIPNJACE`, `PERIONICA` |
| name_sr | text | |
| name_en | text | |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| created_at, updated_at, deleted_at | | |

Seeded initially with codes listed above; admin can add/edit/disable.

### `external_parties`

External suppliers, subcontractors, or manufacturers blamed for errors.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. `JENMAK`, `MOTUS`, `AMC`, `NEWPARTS` |
| kind | text | `supplier` \| `subcontractor` \| `manufacturer` \| `other` |
| notes | text NULL | |
| is_active | boolean | default true |
| created_at, updated_at, deleted_at | | |

---

## Customer tables

### `customers`

Represents both EMOTIVE partners and DOMACE customers.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| kind | text | `emotive_partner` \| `domestic_company` \| `domestic_individual` |
| name | text | |
| tax_id | text NULL | PIB for domestic, VAT ID for foreign |
| address | text NULL | |
| city | text NULL | |
| country | text NULL | ISO 3166-1 alpha-2 (e.g. `RS`, `PL`, `NL`, `DE`) |
| email | citext NULL | |
| phone | text NULL | |
| notes | text NULL | |
| is_active | boolean | default true |
| created_at, updated_at, deleted_at | | |

Seeded EMOTIVE partners: `MR ENGINES`, `MRT POLSKA`, `MRT VEGHEL`, `OVERIGE`,
`NO NAME`, `NEWPARTS`, `VEGE TUNISIE`, `HILLS`, `TRENT`, `ONBEKEND`, `SELMAN`,
`VITOBELLO`, `JONKER`, `HMT`.

### `customer_users` (M:N)

Maps client users to the customer(s) they represent.
A single client account may have access to multiple customer entities
(e.g. someone from MR GROUP might access both `MR ENGINES` and `MRT POLSKA`).

| Column | Type | Notes |
|---|---|---|
| customer_id | uuid FK customers | |
| user_id | uuid FK users | |
| assigned_at | timestamptz | |
| assigned_by | uuid FK users | |

PK: (customer_id, user_id)

---

## Reference catalogs

### `engine_types`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | e.g. `N47D20`, `204PT`, `HRA2`, `CDN` |
| manufacturer | text NULL | e.g. `BMW`, `Ford`, `VW`, `Opel`, `Renault`, `Peugeot` |
| displacement_cc | integer NULL | |
| notes | text NULL | |
| is_active | boolean | default true |
| usage_count | integer | default 0; denormalized counter, incremented on claim insert |
| created_at, updated_at, deleted_at | | |

Seeded with ~200 unique codes extracted from the existing Excel file.
Employees can add new types on the fly from the claim form.

### `claim_sources`

EMOTIVE-only. The `REMARKS` column from Excel.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | `APPROVED_GREEN`, `SELMAN`, `VITOBELLO`, `JONKER`, `HMT`, `HR_GEO_SUPPORT`, `HR_MIROSLAV_VUJIC`, `AUTO_STANIC` |
| name | text | display name (preserved as-is from Excel, e.g. "APPROVED GREEN") |
| default_customer_id | uuid NULL FK customers | fallback customer for claims from this source; admin-configurable without deploy (replaces hardcoded inference) |
| claim_number_prefix | text NULL | e.g. `RGC` (for APPROVED_GREEN), `SEL`, `VB` — used as hint when generating new claim numbers |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| created_at, updated_at, deleted_at | | |

---

## EMOTIVE claims

### `emotive_claims`

Main EMOTIVE (international) claims table. Replaces the `UKUPNO SA…` sheet.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| sequence_number | bigserial UNIQUE | auto-incremented; maps to N0 column in Excel |
| claim_number | text NULL | may be empty during intake; format `RGC-YY-NNNNN`, `SEL0189`, `VB0587`, or legacy numeric |
| warranty_report | text NOT NULL | problem description; the `WARRANTY REPORT` column |
| engine_type_id | uuid FK engine_types NOT NULL | |
| date_of_claim | date NOT NULL | |
| mr_number | text NOT NULL | work order like `5376/25` |
| date_of_finish | date NULL | when the engine was originally finished (before claim) |
| employee_id | uuid FK employees NOT NULL | who originally assembled it |
| source_id | uuid FK claim_sources NOT NULL | |
| outcome | text NOT NULL | `pending` \| `accepted` \| `rejected` \| `archived` |
| claim_year | integer | computed from `date_of_claim` via trigger on INSERT/UPDATE; used for filtering and sheet export |
| customer_id | uuid NULL FK customers | which EMOTIVE partner; inferable from source but stored explicitly |
| internal_notes | text NULL | free-form observations by the firm |
| created_by | uuid FK users | |
| updated_by | uuid FK users NULL | |
| created_at, updated_at, deleted_at | | |

**Indexes:**
- `(date_of_claim DESC)` — for default list order
- `(claim_year, outcome)` — for year-tab filtering
- `(employee_id, claim_year)` — for per-employee stats
- `(source_id)` — for per-source stats
- `(customer_id)` — for per-customer stats
- `(engine_type_id)` — for per-engine-type stats
- GIN on `warranty_report` for full-text search (Serbian locale config)

### `emotive_claim_faults`

A single claim can have multiple fault attributions.
Example from data: GRESKA column = "Glave, Sklapanje" means two departments.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| claim_id | uuid FK emotive_claims ON DELETE CASCADE | |
| fault_type | text NOT NULL | `employee` \| `department` \| `external` |
| employee_id | uuid NULL FK employees | |
| department_id | uuid NULL FK departments | |
| external_party_id | uuid NULL FK external_parties | |
| notes | text NULL | |
| created_at | | |

**Constraint:** exactly one of `employee_id`, `department_id`, `external_party_id`
must be non-null. Enforced via CHECK constraint + application validation.

---

## DOMACE claims

### `domace_claims`

Domestic market claims. Unifies the two Excel formats (pre-2026 and 2026+).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| sequence_number_yearly | integer | R.B. — sequence per year, computed on insert |
| date_received | date NOT NULL | Datum prijema |
| customer_id | uuid NULL FK customers | NULL if walk-in not yet saved as customer |
| customer_name_snapshot | text NOT NULL | always store the displayed name, even when `customer_id` is set, for historical accuracy |
| vehicle | text NOT NULL | `VOZILO`, e.g. `Fiat 1.3 mjtd`, `BMW`, `Iveco` |
| work_order | text NOT NULL | `RADNI NALOG`, e.g. `100911/26` |
| old_work_order | text NULL | `STARI R/N` |
| original_invoice_amount | decimal(14,2) NULL | `IZNOS ORIGINALNOG RACUNA` |
| invoice_number | text NULL | `BROJ RACUNA` |
| problem_description | text NOT NULL | `OPIS PROBLEMA` / `Razlog reklamacije` |
| outcome | text NOT NULL | `pending` \| `accepted` \| `rejected` \| `archived` |
| parts_amount_no_vat | decimal(14,2) NULL | `IZNOS DELOVA BEZ PDV` |
| labor_amount_no_vat | decimal(14,2) NULL | `IZNOS RADA BEZ PDV` — retained even in new format |
| total_amount | decimal(14,2) NULL | `UKUPNO`; auto-computed from parts+labor when both present, overridable |
| assigned_employee_id | uuid NULL FK employees | `Zaduženi radnik` |
| fault_department_id | uuid NULL FK departments | `Odeljenje greške` |
| notes | text NULL | `Napomena` — operational note about the claim |
| internal_notes | text NULL | free-form internal observations |
| claim_year | integer | computed from `date_received` |
| created_by | uuid FK users | |
| updated_by | uuid FK users NULL | |
| created_at, updated_at, deleted_at | | |

**Indexes:**
- `(date_received DESC)`
- `(claim_year, outcome)`
- `(customer_id)`
- `(assigned_employee_id, claim_year)`
- `(fault_department_id, claim_year)`
- GIN on `problem_description` + `customer_name_snapshot` for full-text search

**Computed field:** `sequence_number_yearly` is computed in application code
(not a DB sequence) to restart at 1 for each calendar year:

```sql
-- In repository.create():
INSERT INTO domace_claims (..., sequence_number_yearly, claim_year, ...)
VALUES (
  ...,
  (SELECT COALESCE(MAX(sequence_number_yearly), 0) + 1
   FROM domace_claims
   WHERE claim_year = EXTRACT(YEAR FROM $date_received)::int
     AND deleted_at IS NULL),
  EXTRACT(YEAR FROM $date_received)::int,
  ...
);
```

Wrapped in a transaction with `SELECT FOR UPDATE` to prevent race conditions.

---

## Attachments

### `attachments`

Polymorphic: a single attachment attaches to either an emotive or domace claim.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| claim_kind | text NOT NULL | `emotive` \| `domace` |
| claim_id | uuid NOT NULL | references `emotive_claims.id` or `domace_claims.id` depending on `claim_kind` |
| file_name | text NOT NULL | original filename as uploaded |
| storage_path | text NOT NULL | relative path within volume, e.g. `emotive/2026/<claim_id>/<uuid>.jpg` |
| mime_type | text NOT NULL | |
| file_size_bytes | bigint NOT NULL | |
| width | integer NULL | for images |
| height | integer NULL | for images |
| duration_seconds | integer NULL | for videos |
| thumbnail_path | text NULL | for images/videos, auto-generated |
| caption | text NULL | user-provided description (shown to clients) |
| visibility | text NOT NULL | `internal` \| `client_visible`; default `internal` |
| uploaded_by | uuid FK users | |
| uploaded_at | timestamptz | |
| deleted_at | timestamptz NULL | |

**Indexes:**
- `(claim_kind, claim_id)`
- `(uploaded_at DESC)`

**Visibility rule:** `internal` attachments never appear in the client portal.
`client_visible` attachments show up when the client opens their claim.
Internal notes (`internal_notes` field on the claim) are also never shown to
clients regardless of this setting.

---

## Observations / Notes thread

### `claim_observations`

Chat-like thread of internal observations per claim. Each new observation is
an append-only entry, preserving who wrote what and when.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| claim_kind | text NOT NULL | `emotive` \| `domace` |
| claim_id | uuid NOT NULL | |
| body | text NOT NULL | |
| visibility | text NOT NULL | `internal` \| `client_visible` |
| author_id | uuid FK users | |
| created_at | | |
| edited_at | timestamptz NULL | |
| deleted_at | timestamptz NULL | |

### `translation_cache`

Generic OpenAI translation cache for all translatable text (observations, warranty reports, problem descriptions, notes, captions). Content-addressed by normalized source text hash — no foreign key to `claim_observations` or claims.

| Column | Type | Notes |
|---|---|---|
| source_hash | text | part of PK; SHA-256 of normalized source text |
| source_language | text | part of PK; e.g. `sr` |
| target_language | text | part of PK; e.g. `en` |
| source_text | text NOT NULL | original text (for debugging) |
| translated_text | text NOT NULL | |
| model | text NOT NULL | model that produced the translation |
| tokens_used | integer NULL | |
| created_at | timestamptz NOT NULL | |
| last_accessed_at | timestamptz NOT NULL | for LRU cleanup |
| access_count | integer | default 1 |

PK: (`source_hash`, `source_language`, `target_language`)

**Indexes:**
- `(last_accessed_at)` — LRU cleanup

See `docs/07-translation.md` for cache key normalization and lookup flow.

---

## Employee monthly output

### `employee_monthly_output`

How many engines each employee assembled per month.
Admin enters this manually (no ERP integration).
Used to compute `reklamacije / sklopljeno` ratio.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK employees | |
| year | integer | |
| month | integer | 1–12 |
| engines_assembled | integer | |
| created_at, updated_at, created_by, updated_by | | |

UNIQUE: (employee_id, year, month)

**Indexes:**
- `(employee_id, year, month DESC)`
- `(year, month)`

---

## Audit log

### `audit_log`

Every state-changing action is recorded.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| entity_type | text NOT NULL | e.g. `emotive_claim`, `domace_claim`, `user`, `role`, `customer` |
| entity_id | uuid NOT NULL | |
| action | text NOT NULL | `create` \| `update` \| `delete` \| `restore` \| `login` \| `logout` \| `permission_change` \| `export` \| `import` |
| actor_user_id | uuid NULL FK users | null for system-initiated |
| actor_ip | inet NULL | |
| actor_user_agent | text NULL | |
| changes | jsonb NULL | for `update`: `{field: {before, after}}`; for others: metadata |
| context | jsonb NULL | extra info (e.g. export filter params) |
| created_at | timestamptz | |

**Indexes:**
- `(entity_type, entity_id, created_at DESC)`
- `(actor_user_id, created_at DESC)`
- `(action, created_at DESC)`
- BRIN on `created_at` for time-range queries on large tables

Retention: 2 years; cold archive (dump to NAS) for older records.

---

## Settings (key-value)

### `app_settings`

For admin-configurable values that don't warrant their own table.

| Column | Type | Notes |
|---|---|---|
| key | text PK | e.g. `openai_api_key`, `max_file_size_mb`, `session_timeout_admin_minutes` |
| value | text | serialized (JSON or plain) |
| value_type | text | `string` \| `number` \| `boolean` \| `json` |
| is_secret | boolean | if true, redact from audit log |
| updated_at | | |
| updated_by | uuid FK users | |

---

## Views (for statistics / export convenience)

### `emotive_claims_full` (view)

`emotive_claims` joined with engine_types, employees, claim_sources, customers,
aggregated faults as JSON. Used by list endpoints and export.

### `domace_claims_full` (view)

Analogous join view for domace.

### `stats_emotive_by_year` (materialized view, refreshed nightly)

Pre-aggregated counts for the EMOTIVE statistics sheet:
per (year, customer_id, outcome) → count.

### `stats_domace_by_year` (materialized view, refreshed nightly)

Per (year, outcome, fault_department_id) → count + sum_amounts.

### `stats_per_employee_by_year` (materialized view, refreshed nightly)

Per (employee_id, year) → claims_count, engines_assembled (from `employee_monthly_output`),
ratio.

Refresh triggered nightly via pg_cron, and on demand from admin panel.

---

## Enum value reference (not stored as Postgres enums, but as text columns with CHECK constraints; easier to extend)

- `users.preferred_language`: `sr` | `en`
- `customers.kind`: `emotive_partner` | `domestic_company` | `domestic_individual`
- `roles.code` for system roles: `admin` | `operator` | `viewer` | `client`
- `client_registration_requests.status`: `pending` | `approved` | `rejected` | `needs_info`
- `emotive_claims.outcome`, `domace_claims.outcome`: `pending` | `accepted` | `rejected` | `archived`
- `emotive_claim_faults.fault_type`: `employee` | `department` | `external`
- `external_parties.kind`: `supplier` | `subcontractor` | `manufacturer` | `other`
- `attachments.claim_kind`, `claim_observations.claim_kind`: `emotive` | `domace`
- `attachments.visibility`, `claim_observations.visibility`: `internal` | `client_visible`
- `audit_log.action`: `create` | `update` | `delete` | `restore` | `login` | `logout` | `permission_change` | `export` | `import`

All enum-like columns have application-level TypeScript enums in
`packages/shared/src/enums.ts`, used consistently across API and web.

---

## ERD summary (text)

```
users 1─┬─M user_roles ─M─1 roles 1─M─role_permissions M─1 permissions
        ├─1─ employees (optional, for staff who use the app)
        └─M customer_users M─1 customers

customers 1─M emotive_claims
customers 1─M domace_claims
customers 1─M claim_sources (default_customer_id, optional)

employees 1─M emotive_claims
employees 1─M emotive_claim_faults
employees 1─M domace_claims (assigned_employee)
employees 1─M employee_monthly_output

departments 1─M emotive_claim_faults
departments 1─M domace_claims (fault_department)

external_parties 1─M emotive_claim_faults

engine_types 1─M emotive_claims

claim_sources 1─M emotive_claims

emotive_claims 1─M emotive_claim_faults
emotive_claims 1─M attachments (polymorphic via claim_kind='emotive')
emotive_claims 1─M claim_observations (polymorphic)

domace_claims 1─M attachments (polymorphic via claim_kind='domace')
domace_claims 1─M claim_observations (polymorphic)

translation_cache — standalone (content-addressed; serves observations, claim text fields, captions)

All entities 1─M audit_log (by entity_type + entity_id)
```

---

## Migration notes

- All tables created in a single initial migration.
- Seeds provided for: permissions, system roles, departments, claim_sources,
  initial admin user (from env var).
- Engine types seeded from extracted Excel codes (see `docs/06-excel-flow.md`).
- EMOTIVE partners seeded with initial list.
- Historical Excel data imported via separate ETL job, not initial migration
  (see `docs/06-excel-flow.md`).
