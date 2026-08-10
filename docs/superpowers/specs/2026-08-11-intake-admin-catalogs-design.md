# Prijem vozila — admin dobija kontrolu nad spiskovima (G, dizajn)

**Datum:** 2026-08-11 · **Grana:** `feat/vehicle-intake` · **Osnova:** `1c59476`
**Status:** obim odobren (Nikola, 10.08.), odluka o preimenovanju donета 11.08.

Deo **G** iz reda **A ✅ → B ✅ → G → C → D → E → F**.

---

## 0. Zašto ovo postoji

Nikola, 10.08.: *„nije loše da imamo neke opcije za servis u admin delu jer trenutno nemamo ništa
tamo… drugi razlog je bezbednost, hoću da razdvojim admina od operatera, jer ako to ne uradimo onda
admin deo aplikacije gubi smisla."*

I ima pravo dva puta. `CLAUDE.md` §2 kaže da **svaka funkcija mora da ostavi admin hook** — katalozi
CRUD-abilni iz admina, interno ih samo čita (`docs/13`, obavezujuće). Prijem je otišao bez ijednog:
admin danas ima sedam kataloga i **nijedan za servis**, a prijem zakucava pet spiskova u kod.

⚠️ **Razdvajanje admina od operatera je ZASEBAN posao** i ne meša se ovde. To je pregled svih prava
koja operater danas drži pa odluka šta pripada samo adminu — svoj spec, kad dođe red.

---

## 1. Šta postaje tvoje, a šta ostaje u kodu

| Danas zakucano | Odluka |
|---|---|
| **8 stavki ček-liste** (`INTAKE_CHECKLIST_KEYS`) | **katalog** — dodavanje, gašenje, preimenovanje, redosled |
| **4 tipa oštećenja** (`intakeDamageTypeValues`) | **katalog** — nosi i boju markera na ekranu |
| **3 načina dolaska** (`intakeArrivalModeValues`) | **katalog** |
| 4 tipa vozila | **ostaje u kodu** — svaki nosi *crtež* siluete i mapu zona; nov tip nije red u tabeli nego nov crtež (`docs/25` §3.4) |
| 4 statusa | **ostaje u kodu** — merdevine su ugrađene u pravila (ko sme da napreduje, šta se sme menjati posle potpisa) |

---

## 2. Odluke

| # | Pitanje | Odluka |
|---|---------|--------|
| ⑫ | Šta pišu STARI nalozi kad se stavka preimenuje? | **Nov naziv, svuda.** Nalog pamti **kod** stavke, naziv se čita iz kataloga. Ispravka kucanja se vidi odjednom, ništa se ne duplira i ništa se ne migrira. ⚠️ Cena, svesno prihvaćena: papir koji mušterija drži od prošle godine i ekran više neće pisati isto ako naziv suštinski promeniš. Ako to ikad postane važno, lek je dodatna kolona sa nazivom u trenutku prijema — **aditivna**, ništa se ne gubi. |
| ⑬ | Menja li se oblik podataka na nalogu? | **Ne.** Kolona `checklist` je već `{kod: DA/NE/nedirnuto}`, a ti ključevi su tačno ono što katalog nosi kao `code`. Zod šema se samo **otvara** sa fiksnih osam na „bilo koji kod iz kataloga". **Nema migracije podataka, postojeći nalozi se ne diraju.** |
| ⑭ | Sme li nalog da upiše kod koji ne postoji? | **Ne.** Servis proverava kodove prema katalogu i odbija nepoznat — inače bilo koji pozivalac upisuje šta hoće u dokument koji je dokaz. |
| ⑮ | Gde nestaje naziv iz `m.intake_checklist_*`? | **Briše se.** Naziv živi u bazi, u dve kolone (`name_sr`, `name_en`) — jer se nalog **štampa na oba jezika** (V-7, odluka ⑪), pa katalog bez engleskog naziva odštampa srpski na engleskom papiru. |

---

## 3. Oblik (isti kao postojećih sedam kataloga, ništa novo)

Tabela u `packages/db/src/schema/catalogs.ts`, po uzoru na `departments`:

`id` · `code` (stabilan, jedinstven) · `name_sr` · `name_en` · `sort_order` · `is_active` ·
`created_at` · `updated_at` · `deleted_at` (meko brisanje).

Tip oštećenja dodatno nosi **`marker_colour`** — boju kruga na šemi. ⚠️ Samo za ekran: štampa sve
markere crta crveno bez obzira na tip, jer amber i siva ne izlaze čitko (V-7).

Po katalogu ide: API modul (`apps/api/src/modules/<naziv>/`, sedam fajlova kao `departments`) ·
Zod šeme i query factory u `@mr/shared` · dozvola `settings.<naziv>.manage` · definicija resursa u
`apps/admin-web/src/resources/` · ruta od ~39 linija koja montira `ResourceListPage` · **sistemski
seed** sa današnjim vrednostima (prod-safe, idempotentan po `code`).

⚠️ **Posle deploya ide `pnpm --filter @mr/db run db:seed` jednom** — tri nove dozvole i tri kataloga
sa početnim sadržajem.

---

## 4. Ko čita katalog

Ovo je pravi posao; tabele su lak deo.

| Katalog | Ekrani koji prestaju da čitaju konstantu |
|---|---|
| **Ček-lista** | čarobnjak korak 2 · detalj „Zatečeno stanje" (i čitanje i režim izmene) · **štampa** (model + blok) |
| **Tipovi oštećenja** | čarobnjak korak 3 (birač tipa) · detalj „Šema i nedostaci" (birač i boje markera) · **štampa** (redovi nedostataka) |
| **Načini dolaska** | čarobnjak korak 1 (tri dugmeta) · detalj „Osnovni podaci" · **štampa** |

⚠️ **Štampa je jedini potrošač koji ne sme da promaši jezik.** `buildIntakePrintModel` više ne
prevodi kroz `m.*` nego bira `name_sr`/`name_en` po izabranom jeziku papira — ista odluka ⑪, samo
sada iz baze.

⚠️ **Broj potvrđenih stavki** (`countConfirmed`, „0 / 8 potvrđeno") više nije „od 8" nego „od koliko
ih katalog nudi" — ista greška kao „Korak 2 / 5" koju je brauzer našao u B, pa se ukupan broj i
ovde vodi kao parametar, ne kao literal.

---

## 5. Redosled gradnje

Tri kataloga su strukturno isti, ali im se potrošači ne poklapaju, pa idu odvojeno i svaki je
upotrebljiv čim sleti:

- **G1 — Ček-lista.** Najveći (najviše potrošača) i jedini koji **odblokira C** („+" stavke).
- **G2 — Tipovi oštećenja.** Nosi boju markera.
- **G3 — Načini dolaska.** Najmanji.

Svaki: tabela + seed + API + admin + potrošači + testovi + gejt + komit. Merenje u brauzeru na kraju
svakog — po pravilu iz B da „proverio sam u brauzeru" nije zamena za mutaciju, ali ni obrnuto.

---

## 6. Šta ovo ne dira

Statuse · tipove vozila i siluete · potpise · primopredaju · portal · reklamacije · razdvajanje
admina od operatera (svoj posao) · „+" stavke (to je C, i gradi se NA ovome).
