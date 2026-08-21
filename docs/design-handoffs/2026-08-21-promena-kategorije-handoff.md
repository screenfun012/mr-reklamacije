# Dopuna: promena kategorije na postojećoj reklamaciji

**Za:** Claude Code · **App:** `internal-web` · **Datum:** 21.08.2026
**Dopunjuje:** `2026-08-21-kategorije-design-handoff.md` (§3 čip kategorije u čarobnjaku, §4 detalj, §9 polja kategorije). Vizuelni jezik: postojeći `--mri-*` tokeni i obrasci — ništa novo se ne izmišlja.

## Problem koji rešavamo

Radnik unese reklamaciju kao **Generalni remont**, a trebalo je **Mašinska obrada**. Kategorija mora da može da se promeni i POSLE čuvanja — ali pošto svaka kategorija nosi svoja polja (config-driven, prethodna dopuna), promena kategorije znači: stara polja prestaju da važe, nova polja moraju da se unesu, i to mora biti **vidljivo naglašeno**, ne tiho.

## 1. Gde se menja

- **Detalj reklamacije** — čip kategorije uz naslov postaje klikabilan (▾): otvara isti meni kategorija kao u čarobnjaku. Permisija: ista koja danas dozvoljava izmenu reklamacije (ne nova).
- U čarobnjaku (pre čuvanja) već postoji čip ▾ — tamo je promena slobodna, ovo je pravilo za POSLE čuvanja.

## 2. Tok promene (obavezno kroz dijalog potvrde)

Klik na novu kategoriju → **dijalog potvrde** (standardni 480px obrazac):
- Naslov: „Promena kategorije"
- Tekst: „**{stara} → {nova}**. Polja kategorije „{stara}" prestaju da važe (vrednosti se čuvaju u istoriji), a polja kategorije „{nova}" treba uneti."
- Ako nova kategorija ima obavezna polja: amber nota „Reklamacija će biti označena dok se nova polja ne popune."
- Dugmad: OTKAŽI outline · **PROMENI KATEGORIJU** primarno (svetla ispuna — NIJE destruktivno crveno; ništa se ne briše).

Posle potvrde: toast „Kategorija promenjena: {stara} → {nova}" + kartica „Polja kategorije" se odmah zamenjuje novom.

## 3. Šta se dešava sa podacima

- **Stara polja se NE brišu** — vrednosti ostaju sačuvane u bazi, vezane za staru kategoriju (isti princip kao §9 „ukinuto polje": nikad ne gubi unete podatke).
- U kartici „Polja kategorije" stara polja se prikazuju u posebnoj sekciji **„Prethodna kategorija · {stara}"** — prigušeno, sa dashed značkom `PRETHODNO`, read-only. Ako je vlasniku to previše vizuelne buke: sklopivo (collapsed po defaultu, „Prikaži ▾").
- **Nova polja** dolaze prazna — svaki unos ide normalno kroz izmenu reklamacije.

## 4. Naglašavanje da polja nedostaju (srž zahteva)

Dok obavezna/očekivana polja nove kategorije nisu popunjena:
- Kartica „Polja kategorije" u detalju dobija **amber tretman**: ivica `1px dashed rgba(234,179,8,.4)`, u headeru kartice mono značka **`⚠ DOPUNI PODATKE`** (amber tinta `.1`, dashed ivica).
- Svako nepopunjeno polje: italic `--mri-text2` „Nije popunjeno" + amber tačka uz labelu.
- U **listi reklamacija**: mali amber indikator uz čip kategorije (tačka ili `⚠`), tooltip „Promenjena kategorija — dopuni polja". Bez novog filtera zasad.
- Značka nestaje čim su polja popunjena (računa se iz config šeme, ne ručni flag).

## 5. Trag izmene (audit)

- Promena kategorije ide u **postojeći audit sistem** kao izmena polja: `kategorija: {stara} → {nova}` (crveni/zeleni čip obrazac iz admin Revizije), sa korisnikom i vremenom.
- U detalju, uz čip kategorije, mono meta red: „Kategorija promenjena {datum} — {ime}" (siva, 10.5px, mono) — vidljivo bez otvaranja audita. Prikazuje se samo ako je reklamacija ikada menjala kategoriju.

## 6. API (prijavi pre nego što praviš)

- Mutacija: `PATCH` postojeće izmene reklamacije sa `categoryId` — ako izmena kategorije danas nije dozvoljena na endpointu, dodaj je (uz audit zapis).
- Vrednosti polja po kategoriji: čuvaju se uz `categoryId` konteksta u kom su unete (da „prethodna" sekcija zna šta je čije). Šema polja i dalje NE postoji — ovo je mehanizam, config ostaje prazan dok vlasnik ne odobri polja.

## 7. i18n

Novi ključevi (SR+EN): naslov/tekst dijaloga, „DOPUNI PODATKE", „Nije popunjeno" (postoji), „Prethodna kategorija", „Kategorija promenjena {datum} — {ime}", toast. Bez množina.

## Prihvatanje

- [ ] Promena kategorije moguća iz detalja, kroz dijalog, sa ispravnom permisijom.
- [ ] Stare vrednosti sačuvane i vidljive kao „Prethodna kategorija" (read-only).
- [ ] Nova polja prazna + amber „⚠ DOPUNI PODATKE" na kartici dok se ne popune; indikator i u listi.
- [ ] Audit zapis + meta red u detalju.
- [ ] Ništa od ovoga ne pravi stvarna polja u bazi — mehanizam radi i sa praznim config-om (tada nema „dopuni" stanja).

Ako nešto ne može da se pomiri sa postojećim kodom — pitaj, ne improvizuj.
