# 07 — Translation (OpenAI)

> ⚠ **NOT BUILT.** No `translation` module exists in the API. This is a design document.
> Its two permissions (`translation.request`, `translation.manage_cache`) were retired from the
> catalog on 2026-08-17 — nothing checked them. Building this feature adds them back.

Translation is used exclusively for the client portal, so international clients
(e.g. MRT POLSKA) can read Serbian-language fields like problem descriptions,
observations, and notes in English.

## Scope

**Translatable content:**
- `emotive_claims.warranty_report`
- `emotive_claims.internal_notes` — only if `visibility = 'client_visible'` (future flag)
- `domace_claims.problem_description`
- `domace_claims.notes`
- `claim_observations.body` (where `visibility = 'client_visible'`)
- Attachment captions (`attachments.caption`)

**NOT translatable:**
- Structured data (employee names, dates, MR numbers, status values) — rendered with fixed English labels from Paraglide
- Internal notes with `visibility = 'internal'` — never exposed to clients
- UI chrome (buttons, headers, form labels) — handled by Paraglide, not OpenAI

**Source languages:** Serbian only (the Latin-script version; Cyrillic users are out of scope for MVP).
**Target languages:** English only for MVP. Architecture supports adding more later.

## User experience

1. Client logs into portal, their `users.preferred_language` is `en`
2. Client opens a claim; Serbian text fields are shown **as-is** by default
3. Next to each translatable text block, a small `🌐 Translate` button appears
4. Client clicks → request fires → spinner → translated text displayed **below** original with a label "English translation"
5. "Show original" toggle to revert
6. Cached on server so subsequent clicks (by anyone, for the same text) are instant

## Configuration

### Environment variables

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS_PER_REQUEST=2000
TRANSLATION_CACHE_TTL_DAYS=365   # cache entries live for 1 year
TRANSLATION_RATE_LIMIT_PER_USER_PER_HOUR=60
```

### Admin UI

In admin panel → Settings → "Translation":
- Input for OPENAI_API_KEY (stored in `app_settings` with `is_secret=true`)
- Model selector (`gpt-4o-mini` default, `gpt-4o` option for higher quality)
- Cache management: view stats, clear cache

## API endpoint

```
POST /api/translate
Content-Type: application/json

{
  "text": "Curenje ulja na zadnjem semeringu radilice",
  "sourceLanguage": "sr",
  "targetLanguage": "en",
  "context": "warranty_report"     // optional: gives GPT domain context
}
```

**Response:**
```
{
  "translated": "Oil leak on the rear crankshaft seal",
  "cached": true,
  "tokensUsed": 0,
  "cachedAt": "2026-03-14T10:22:11Z"
}
```

Errors:
- `401` — not authenticated
- `403` — no `translation.request` permission
- `429` — user rate limit exceeded
- `502` — OpenAI API unavailable; fallback to returning original text with `error` field

## Caching strategy

We do NOT call OpenAI twice for the same text. All cached translations live in `translation_cache` (schema below).

### `translation_cache` table

```
CREATE TABLE translation_cache (
  source_hash text NOT NULL,       -- SHA256 of source text
  source_language text NOT NULL,
  target_language text NOT NULL,
  source_text text NOT NULL,       -- original, for debugging
  translated_text text NOT NULL,
  model text NOT NULL,             -- which model produced it
  tokens_used integer,
  created_at timestamptz NOT NULL,
  last_accessed_at timestamptz NOT NULL,
  access_count integer DEFAULT 1,
  PRIMARY KEY (source_hash, source_language, target_language)
);
```

Index on `last_accessed_at` for LRU cleanup.

### Cache key

`source_hash = sha256(normalize(source_text))` where `normalize` lowercases and
collapses whitespace. This means minor whitespace variations don't create
duplicate cache entries.

### Cache lookup flow

```ts
async translate(input: TranslateInput, user: AuthUser): Promise<TranslateResult> {
  const normalized = normalize(input.text)
  const hash = sha256(normalized)

  // 1. Try cache
  const cached = await this.cache.find(hash, input.sourceLanguage, input.targetLanguage)
  if (cached) {
    await this.cache.touch(cached.id)  // update last_accessed + increment count
    return { translated: cached.translated_text, cached: true, tokensUsed: 0, cachedAt: cached.created_at }
  }

  // 2. Call OpenAI
  await this.rateLimit.check(user.id)
  const result = await this.openai.translate({
    text: input.text,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    context: input.context,
  })

  // 3. Store in cache
  await this.cache.insert({
    source_hash: hash,
    source_language: input.sourceLanguage,
    target_language: input.targetLanguage,
    source_text: input.text,
    translated_text: result.translation,
    model: this.config.model,
    tokens_used: result.tokensUsed,
  })

  return { translated: result.translation, cached: false, tokensUsed: result.tokensUsed }
}
```

### Cache cleanup

Daily cron job:
```sql
DELETE FROM translation_cache
WHERE last_accessed_at < NOW() - INTERVAL '365 days';
```

Admin can manually clear cache from Settings page.

## Prompt engineering

Single prompt template, varied by context:

```ts
function buildPrompt(input: TranslateInput): string {
  const contextHint: Record<string, string> = {
    warranty_report: 'This is a technical description of an engine warranty claim. Use standard automotive/mechanical English terminology.',
    problem_description: 'This is a customer-facing description of an engine problem reported at a Serbian repair shop. Use standard automotive terminology.',
    observation: 'This is an internal company observation about a warranty claim. Preserve the original tone and technical details.',
    notes: 'This is a short note about a warranty claim. Preserve any specific numbers, names, or references.',
    caption: 'This is an image caption describing engine parts or damage.',
  }

  const contextLine = input.context
    ? `Context: ${contextHint[input.context] ?? ''}\n\n`
    : ''

  return `You are a professional translator specializing in automotive and engine manufacturing terminology. Translate the following text from Serbian to English.

${contextLine}Rules:
- Translate accurately and naturally. Do not add explanations or commentary.
- Preserve engine part names (e.g., "klipnjača" = "connecting rod", "radilica" = "crankshaft", "bregasto vratilo" = "camshaft").
- Preserve part numbers, codes, and names exactly (e.g., "RGC-25-33731", "N47D20", "MR-5376/25").
- Preserve employee names exactly.
- Keep abbreviations where they are domain-standard (VVT, TDI, etc.).
- If the text contains multiple sentences, translate each. Do not summarize.

Serbian text:
${input.text}

English translation:`
}
```

### Model choice

- **Default:** `gpt-4o-mini` — fast, cheap, sufficient for technical translation
- **Upgradable:** admin can switch to `gpt-4o` per Settings; used for all new translations (old cache stays)

### Token budget

- `gpt-4o-mini` prompt + response for typical observation (~200 chars Serbian → ~200 chars English) uses ~200 input + 100 output tokens
- Cost: ~$0.00006 per translation (essentially free)
- Expected volume: ~500 translations/month = $0.03/month
- Cap: `OPENAI_MAX_TOKENS_PER_REQUEST=2000` prevents runaway costs from abuse

## Rate limiting per user

Each client user is limited to **60 translation requests per hour**. Admin and
operators have higher limits (300/hour) since they may test translations.

Implementation: simple in-memory sliding window per `user.id`. If rate exceeded,
return `429` with a `Retry-After` header. Rate limit bypasses cache hits
(cached translations don't count against limit).

## Security considerations

- API key never leaves the server; never included in response or error messages
- All translation requests logged in `audit_log` with entity_type `translation`
- Source text stored in cache may contain sensitive info (names, locations) —
  cache is within our DB, not shared
- If we ever offer an "export cache" feature for auditing, admin-only with confirmation

## Failure modes

| Failure | Behavior |
|---|---|
| OpenAI API down | Return 502 to client; UI falls back to original text, shows toast "Prevod trenutno nije dostupan" |
| OpenAI rate limit (our account) | Same as above |
| User rate limit | Return 429; UI disables translate button for 60s |
| Invalid API key | Admin-only alert in admin dashboard; translations disabled globally |
| Network timeout | Retry once with 2s backoff, then error out |

## Testing

- **Unit:** mock OpenAI client, test cache hit/miss, normalization, rate limits
- **Integration:** real DB, mocked OpenAI responses
- **E2E:** stub OpenAI at Playwright level to return deterministic translations
- **Manual smoke:** once per release, verify with real API key on staging

## Future enhancements (out of scope for MVP)

- Support more target languages (Polish, Dutch for MRT partners)
- Automatic translation on save (pre-warm cache for any text entered by operator)
- Side-by-side bilingual display with highlighted differences
- Translation memory UI for admin (see all cached entries, manually correct)
