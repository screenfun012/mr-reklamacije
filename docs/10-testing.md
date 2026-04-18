# 10 — Testing Strategy

Testing is **not optional**. Every module ships with tests. No code merges without passing CI.

## Philosophy

1. **Test behavior, not implementation.** Tests describe what the system does, not how.
2. **Prefer integration tests over mocking.** If a test mocks everything, it tests nothing.
3. **Tests are first-class code.** Same style rules, same review process, no "quick hack" tests.
4. **Broken tests are broken features.** Never skip or `xit` tests without a tracking issue.

## Coverage targets

| Layer | Target | Enforcement |
|---|---|---|
| Services (business logic) | 90%+ branch coverage | CI fails below threshold |
| Repositories | 85%+ branch coverage | CI fails below threshold |
| Controllers | 80%+ branch coverage | CI fails below threshold |
| Utilities (pure functions) | 100% | CI fails below 100% |
| Overall API | 85% minimum | CI fails below threshold |
| Web components (critical paths) | 70% | Warning only |
| Excel import/export | 95%+ | CI fails below threshold |
| Auth + permissions | 95%+ | CI fails below threshold |

Coverage is measured with **V8 coverage** via Vitest.

## Test layers

### 1. Unit tests (Vitest)

- **Scope:** single function / class method
- **Location:** `apps/*/src/**/__tests__/*.test.ts`, `packages/*/src/**/__tests__/*.test.ts`
- **Speed:** < 10 ms per test
- **Isolation:** no DB, no filesystem, no network
- **When to use:** pure functions, algorithms, validators, normalizers, parsers

Example:

```ts
// packages/shared/src/utils/__tests__/normalize-name.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeName } from '../normalize-name'

describe('normalizeName', () => {
  it('strips diacritics', () => {
    expect(normalizeName('Dejan Milovanović')).toBe('DEJAN MILOVANOVIC')
  })

  it('maps đ/Đ to d/D', () => {
    expect(normalizeName('Đorđe Đukić')).toBe('DORDE DUKIC')
  })

  it('collapses whitespace', () => {
    expect(normalizeName('  ivica   stanisavljević  ')).toBe('IVICA STANISAVLJEVIC')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName('   ')).toBe('')
  })
})
```

### 2. Integration tests (Vitest + test Postgres)

- **Scope:** multiple units working together with real dependencies
- **Location:** `apps/api/src/modules/*/__tests__/*.integration.test.ts` and `apps/api/tests/integration/*.test.ts`
- **Speed:** < 1 s per test
- **Isolation:** each test runs in a transaction that rolls back at end
- **When to use:** repository + service interaction, controller → service → repository full stack

Setup:

```ts
// apps/api/tests/helpers/test-db.ts
import { newDb } from 'pg-mem'  // or real Postgres container; see below
import { drizzle } from 'drizzle-orm/node-postgres'

export async function createTestContext() {
  const pool = await createTestPostgresPool()  // uses pgbouncer on staging DB or throw-away docker container
  const db = drizzle(pool)
  const container = buildContainer({ db })
  const tx = await pool.query('BEGIN')

  return {
    container,
    db,
    cleanup: async () => {
      await pool.query('ROLLBACK')
      await pool.end()
    },
  }
}
```

Example:

```ts
// apps/api/src/modules/emotive-claims/__tests__/emotive-claims.service.integration.test.ts
describe('EmotiveClaimsService', () => {
  let ctx: TestContext

  beforeEach(async () => { ctx = await createTestContext() })
  afterEach(async () => { await ctx.cleanup() })

  it('creates a claim with fault attribution', async () => {
    const admin = await createTestUser(ctx, { role: 'admin' })
    const employee = await createTestEmployee(ctx, { name: 'Ivica Test' })
    const dept = await getTestDepartment(ctx, 'GLAVE')
    const engineType = await createTestEngineType(ctx, 'N47D20')
    const source = await getTestClaimSource(ctx, 'APPROVED_GREEN')

    const claim = await ctx.container.emotiveClaimsService.create({
      warrantyReport: 'Test report',
      engineTypeId: engineType.id,
      dateOfClaim: new Date('2026-04-01'),
      mrNumber: '1234/26',
      employeeId: employee.id,
      sourceId: source.id,
      outcome: 'pending',
      faults: [{ faultType: 'department', departmentId: dept.id }],
    }, admin)

    expect(claim.id).toBeDefined()
    expect(claim.claimYear).toBe(2026)
    expect(claim.faults).toHaveLength(1)
    expect(claim.faults[0].department?.code).toBe('GLAVE')
  })

  it('prevents viewer from creating claims', async () => {
    const viewer = await createTestUser(ctx, { role: 'viewer' })
    await expect(
      ctx.container.emotiveClaimsService.create(validInput, viewer)
    ).rejects.toThrow(ForbiddenError)
  })
})
```

### 3. E2E tests (Playwright)

- **Scope:** full user flow through browser
- **Location:** `apps/*/tests/e2e/*.e2e.ts`
- **Speed:** 1–5 s per test
- **Isolation:** separate test database, seeded fixture data
- **When to use:** critical user journeys only — not every feature

Critical flows to cover (not exhaustive, but must-have):

**admin-web:**
- `login.e2e.ts` — login flow, 2FA, bad creds
- `create-user.e2e.ts` — admin creates new user, user receives reset link (email mocked)
- `edit-role.e2e.ts` — admin edits role permissions, affected user sees change live (via SSE)
- `import-excel.e2e.ts` — dry-run preview + commit
- `registration-approval.e2e.ts` — client submits registration, admin approves

**internal-web:**
- `create-emotive-claim.e2e.ts` — operator creates claim with all fields, uploads attachment
- `create-domace-claim.e2e.ts`
- `change-outcome.e2e.ts`
- `export-workbook.e2e.ts`
- `search-claims.e2e.ts`
- `view-stats.e2e.ts`

**portal-web:**
- `register-client.e2e.ts`
- `login-as-client.e2e.ts`
- `view-own-claims.e2e.ts` — verify that other customers' claims are NOT visible
- `translate-observation.e2e.ts`

Example:

```ts
// apps/internal-web/tests/e2e/create-emotive-claim.e2e.ts
import { test, expect } from '@playwright/test'
import { loginAsOperator, seedDatabase } from './helpers'

test.describe('Create EMOTIVE claim', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase()
    await loginAsOperator(page)
  })

  test('operator creates a claim with fault attribution', async ({ page }) => {
    await page.goto('/emotive-claims')
    await page.getByRole('button', { name: /nova reklamacija/i }).click()

    await page.getByLabel('Warranty report').fill('Test curenje ulja')
    await page.getByLabel('Engine type').click()
    await page.getByRole('option', { name: 'N47D20' }).click()
    await page.getByLabel('Date of claim').fill('01.04.2026')
    await page.getByLabel('MR Number').fill('9999/26')
    await page.getByLabel('Employee').click()
    await page.getByRole('option', { name: 'Ivica Stanisavljević' }).click()
    await page.getByLabel('Source').click()
    await page.getByRole('option', { name: 'APPROVED GREEN' }).click()

    await page.getByRole('button', { name: /dodaj gresku/i }).click()
    await page.getByLabel('Department').click()
    await page.getByRole('option', { name: 'BLOKOVI' }).click()

    await page.getByRole('button', { name: /sačuvaj/i }).click()

    await expect(page).toHaveURL(/\/emotive-claims\/[a-f0-9-]+$/)
    await expect(page.getByText('Test curenje ulja')).toBeVisible()
    await expect(page.getByText('BLOKOVI')).toBeVisible()
  })
})
```

### 4. Contract tests (Zod schema)

- **Scope:** API request/response shape
- Since API and web share Zod schemas from `packages/shared`, schema mismatch is impossible
- Runtime schema validation on every API response in dev mode (toggle via env)

### 5. Visual regression tests (optional, low priority)

- Playwright's `toHaveScreenshot()` on key pages
- Only for admin panel (we change portal + internal often)
- Baseline images committed; CI diffs on PR

---

## Test infrastructure

### Vitest config

```ts
// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
      exclude: [
        '**/__tests__/**',
        '**/*.d.ts',
        'src/server.ts',
        'src/infrastructure/logger/**',
      ],
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

### Test database strategy

**Option chosen: real Postgres via Docker Compose**, fresh database per test file.

`tests/setup.ts`:
```ts
import { beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'

beforeAll(async () => {
  // Start a fresh test database
  process.env.DATABASE_URL = `postgresql://test:test@localhost:5433/mr_test_${process.pid}`
  execSync(`createdb mr_test_${process.pid}`)
  execSync('pnpm db:migrate')
  execSync('pnpm db:seed:test')
})

afterAll(async () => {
  execSync(`dropdb mr_test_${process.pid}`)
})
```

Each test runs inside a transaction that's rolled back, so tests don't
interfere with each other.

### Test fixtures

```ts
// apps/api/tests/helpers/fixtures.ts
export async function createTestUser(ctx: TestContext, opts: {
  role?: SystemRole
  email?: string
  language?: 'sr' | 'en'
}): Promise<AuthUser> {
  const email = opts.email ?? `test-${crypto.randomUUID()}@example.com`
  const user = await ctx.container.usersService.create({
    email,
    name: 'Test User',
    preferredLanguage: opts.language ?? 'sr',
    roleCode: opts.role ?? 'operator',
  }, /* actor */ SYSTEM_ACTOR)
  return toAuthUser(user)
}

export async function createTestEmotiveClaim(
  ctx: TestContext,
  overrides?: Partial<EmotiveClaimCreateInput>
): Promise<EmotiveClaim> {
  return ctx.container.emotiveClaimsService.create({
    warrantyReport: 'Default test report',
    engineTypeId: await ensureTestEngineType(ctx),
    dateOfClaim: new Date('2026-01-15'),
    mrNumber: 'TEST/26',
    employeeId: await ensureTestEmployee(ctx),
    sourceId: await ensureTestClaimSource(ctx),
    outcome: 'pending',
    ...overrides,
  }, SYSTEM_ACTOR)
}
```

### Playwright config

```ts
// apps/internal-web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,           // tests share a DB; don't parallel
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'pnpm dev:test',
    port: 3001,
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## Mocking policy

### Never mock

- Database — use real Postgres
- Zod schemas — they're cheap
- Domain services within the same app — use real instances
- HTTP routes — test through real Hono app instance

### Sometimes mock

- OpenAI API — mock by default; real only in dedicated tests tagged `[real-api]`
- Email sending — mock; inspect sent messages via test collector
- File system (for unit tests) — mock; integration tests use temp dir
- SSE event bus for unit tests of services — real bus in integration tests

### Always mock

- `new Date()` / time — use `vi.setSystemTime` so tests are deterministic
- `Math.random` / UUIDs — only when test needs specific values
- External APIs (OpenAI, email) — except in tagged real-api tests

### Example: mocking OpenAI

```ts
// tests/helpers/openai-mock.ts
export function mockOpenAI(container: Container) {
  const spy = vi.fn().mockResolvedValue({ translation: 'Mocked translation', tokensUsed: 10 })
  container.openai = { translate: spy } as any
  return spy
}

// usage
it('returns translation from OpenAI when not cached', async () => {
  const spy = mockOpenAI(ctx.container)
  const result = await ctx.container.translationService.translate({
    text: 'Test',
    sourceLanguage: 'sr',
    targetLanguage: 'en',
  }, user)
  expect(spy).toHaveBeenCalledOnce()
  expect(result.translated).toBe('Mocked translation')
})
```

---

## Test naming

Format: `describe(ClassOrFunctionName) → describe(scenario) → it(expected behavior)`

```ts
describe('EmotiveClaimsRepository', () => {
  describe('when listing claims', () => {
    it('returns all claims for admin user', async () => { ... })
    it('filters by customer for client user', async () => { ... })
    it('excludes soft-deleted claims by default', async () => { ... })
    it('includes soft-deleted claims when requested', async () => { ... })
  })

  describe('when creating a claim', () => {
    it('assigns sequential number', async () => { ... })
    it('computes claim_year from date_of_claim', async () => { ... })
    it('throws ValidationError for missing mr_number', async () => { ... })
  })
})
```

**Rules:**
- `it` starts with a verb
- `describe` (inner) describes the scenario (`"when ..."`, `"given ..."`)
- No "should" in test names — just state what it does

---

## CI pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: mr_test
        ports: [5433:5432]
        options: --health-cmd="pg_isready"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5433/mr_test
      - name: Check coverage thresholds
        run: pnpm coverage:check

  e2e:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/*/playwright-report
```

CI must be green for merge. No exceptions.

---

## Test data discipline

- **No hardcoded IDs** in tests. Always create fixtures.
- **No shared state** between tests. Every test starts fresh.
- **Realistic data.** Use names, dates, amounts that look like production (not `foo`, `bar`, `test1`).
- **Serbian-specific test data.** Include diacritics, Cyrillic, Serbian-format dates to catch i18n bugs.

---

## Performance tests (out of scope for MVP)

Not included in MVP. Baseline if we need them later: k6 scripts hitting staging.

## Security tests

- Dependency scanning: `pnpm audit` in CI — blocks on HIGH or CRITICAL CVEs
- Secret scanning: GitHub's built-in + `gitleaks` in CI
- SAST: no heavy tooling in MVP; rely on TypeScript strict mode + good review

---

## When to write tests

**Always:**
- New public API endpoint → controller + service integration test
- New service method → service unit/integration test
- New pure function → unit test
- Bug fix → regression test that would've caught it

**Sometimes:**
- Refactor: tests should already exist; update only if behavior changed
- UI component: test if it has non-trivial logic; skip for purely presentational

**TDD cycle:** for every task, write the failing test first, then make it pass.

---

## Test review checklist

When reviewing a PR, check:

- [ ] Tests cover the happy path
- [ ] Tests cover at least one failure path
- [ ] Tests check permission boundaries for protected operations
- [ ] Tests don't rely on specific IDs, timestamps, or order
- [ ] Test names describe behavior, not implementation
- [ ] No `skip` or `only` left in
- [ ] No commented-out tests
- [ ] Coverage didn't drop
