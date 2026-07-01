# STATUS — Portal Faza B (2026-07-01)

> Snimak gde smo stali. Kad Faza B završi, ovaj fajl obrisati.

## ✅ Commitovano (na `main`, čeka Nikolin push)

- `b0bfb8a` **A.1** — approve klijenta + veza za firmu (`customer_users`, atomski, `customers.link_users`)
- `9d4204f` **A.2** — passwordless portal registracija (migracija 0019 `users.requested_company`)
- `99b9b31` **C.1** — Resend + aktivacioni token backend (@mr/email, migracija 0020 `client_activation_tokens`)
- `c90d5bf` **C.2** — client activation ekran + admin „Pošalji ponovo link"
- `29951f8` **test-fix** — clamp statistics claim datuma na tekući mesec (root-cause; vidi dole)
- `ce6dd26` **B.0** — whitelist client-safe payload (BELA LISTA); klijent ne vidi krivicu/radnika/interne beleške

**Ceo tok aktivacije DOKAZAN end-to-end u browseru:** registracija → admin odobri + firma → Resend mejl → `/activate` → lozinka → klijent uđe na portal.

**Resend config:** ključ u `apps/api/.env` (NE root `.env`), sender `onboarding@resend.dev`, besplatan tier šalje samo na Resend-nalog-mejl `screenfun012@gmail.com`. (Vidi memoriju `api-env-file-location`.)

## 🧾 Šta je bio statistics „bloker" i zašto clamp (ne mock)

Rolling-24-mesečni prozor se računa **u bazi preko `CURRENT_DATE`** (`statistics-claim-filter.ts:92-93`), a claim datumi u testu u **JS-u** (`daysAgo`). `vi.setSystemTime` mockuje samo JS sat → NE pomera Postgres prozor → mock bi razišao datume od prozora (gore). Prvih ~10-20 dana meseca `daysAgo(N)` padne u prošli mesec dok test tvrdi tekući → pad (1. jul pogodio). **Fix:** clamp `daysAgo` na 1. u tekućem mesecu (samo test helper). Nijansa zabeležena u CLAUDE.md §Testing.

## ⏸️ ČEKA: Nikolina B.0 verifikacija (napad preko API-ja)

Pre B.1, potvrdi da klijent preko **direktnog API poziva** (ne UI) NE vidi:

- `faults[]` / `employeeId` / `employeeName` (krivica + radnik)
- `internalNotes` (interne beleške)
- tuđe reklamacije → **404** (cross-customer)

Automatski napad-testovi već zeleni; ovo je ručna živa potvrda.

## ▶️ SLEDEĆE (posle verifikacije, OVIM redom)

1. **B.1** — portal lista MOJIH reklamacija (`/claims`, row-level, read-only; status badge, osnovni podaci). Unified `/api/claims`.
2. **B.2** — portal detalj read-only (status, `warrantyReport`, client-visible slike; krivica/beleške/radnik SAKRIVENI — B.0 ih i ne šalje). Detalj = emotive-only.
3. **B.3** — šest jezika (EN default portal + SR/ES/NL/DE/FR; samo portal-ključevi, ostalo fallback; OpenAI mašinski prvi prolaz + revizija; NE menjati globalni `baseLocale`).
4. **Test izolacije kroz sve** — klijent A ne vidi B preko URL-a → 404.

## 🎨 PARALELNO (Nikola van Claude Code)

Dizajn portala preko Claude Design (moćan/industrijski, animirana 3D geometrija na login, suptilan wow prvi ulazak, MR Engines brandbook). **B.1/B.2 graditi sa ČISTOM separacijom stil/struktura** (semantički HTML, logika odvojena od prezentacije, sve preko `m.*` + `mr-*` tokena) da se dizajn presvuče KASNIJE bez prepravke logike. Mapa namere stoji.

## 🔒 Odluke B (potvrđene — NE revidirati)

1. Izveštaj = `warrantyReport` tekst (NE rich `claim_reports`, gejtovan)
2. Klijent-safe = zaseban zod tip, **BELA LISTA**
3. 6 jezika = samo portal-ključevi, ostalo fallback
4. Prevodi = OpenAI + revizija; **NE menjati `baseLocale`** (admin/interno ostaju sr-default)
5. Lista = unified `/api/claims`; detalj = emotive-only
6. Redosled = **B.0 security PRVO** ✅ (urađeno)

## ⚠️ Ograde

Ne dirati admin/internu. Row-level izolacija = **NIKOLA-SAFE** nivo (dokazivati napadom, 404 za tuđe). Domace za klijente = prazno/404 (nema `customer_id` FK) — EMOTIVE-only za sad.
