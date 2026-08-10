# Prijem vozila — čarobnjak se skraćuje, dokument izlazi sam (B, dizajn + plan)

**Datum:** 2026-08-10 · **Grana:** `feat/vehicle-intake` · **Osnova:** `fd4ed19`
**Status:** obim odobren (Nikola, 10.08. — „kreni, verujem ti")

Kratak je, pa je ovo i dizajn i plan u jednom. Deo **B** iz dogovorenog reda
**A ✅ → B → G → C → D → E → F** (§0).

---

## 0. Odakle ovo dolazi

Nikola je 10.08. opisao stvarni tok, koji se razlikuje od onoga po kom je modul sagrađen:
**prijem popunjava radnik na prijemu i tu se prijem završava** — vozilo i vlasnik, ček-lista,
stanje i fotke, pa potpisi, pa dokument koji ide vlasniku. **Specifikacija (usluge i materijal)
nije njegov posao** — nju radi serviser, kasnije, u drugoj fazi.

Ovaj deo radi samo to. Ne dira prava, kataloge, „+" stavke ni primopredaju.

⚠️ **Nadređeno pravilo je `docs/25` §3.0** („ekran vodi, radnik se vozi", Nikola 10.08.): ljudi koji
ovo koriste nisu računarski pismeni i naći će svaku rupu. Zato se odluke ispod ne biraju po tome
šta je fleksibilnije nego po tome šta traži manje odluka od radnika.

---

## 1. Odluke

| # | Pitanje | Odluka |
|---|---------|--------|
| ① | Šta sa korakom „Specifikacija" u čarobnjaku? | **Briše se iz čarobnjaka.** Radnik na prijemu je ne vidi uopšte — ne „vidi je praznu". Jedan korak manje i nijedna odluka „da li ja ovo popunjavam". Ostaje kao tab na detalju, gde i danas radi. |
| ② | Kad radnik potpiše, kako dolazi do dokumenta? | **Pregled štampe se otvara sam.** Ne traži dugme. Po §3.0 tačka 1: ono što sledi je jedina glasna stvar na ekranu, i otvaranje JESTE uputstvo. |
| ③ | Fotografije na dokumentu? | **Nema ih.** Nikola: „to ne mora da stoji, može da stoji koliko slika je slikano". Broj već stoji u redu sa ciframa (GORIVO · NEDOSTACI · **FOTOGRAFIJA** · PRIMEDBE), a pravna rečenica kaže „({count} fotografija, arhivirano uz nalog {broj})" — mušterija time zna da postoje. Isto važi i za dokument o primopredaji (F), pa se blok **briše**, ne skriva iza varijante. |

---

## 2. Šta se briše (i zašto se briše, a ne zaobilazi)

- `wizard/step-specification.tsx` → **fajl nestaje**. `IntakeSpecList` iz njega **koristi i detalj**
  (`detail/tab-spec.tsx`), pa se lista seli u `wizard/intake-spec-list.tsx`; ostaje samo omotač
  koraka, koji se briše. Fajl imenovan po koraku koji više ne postoji je zamka za sledećeg čitaoca.
- `print/intake-print-photos.tsx` → **fajl nestaje**, sa njim i ključevi
  `intake_print_section_photos` i `intake_print_photos_more`.
- **Sa fotografijama odlazi i čekanje na slike** u `print/intake-print-dialog.tsx`: brojač
  `settled`/`expected` i `onLoad`/`onError` na omotaču postoje samo zato što je `window.print()`
  umeo da odštampa prazne okvire. Bez ijedne slike na listu, dugme „Štampaj" nema šta da čeka.
  Ostavljati mrtvu kapiju „za svaki slučaj" je tačno ono što se posle ne ume objasniti.

---

## 3. Koraci čarobnjaka

Bilo: `1 Vozilo i vlasnik · 2 Ček-lista · 3 Stanje i fotke · 4 Specifikacija · 5 Potpisi`
Sada: `1 Vozilo i vlasnik · 2 Ček-lista · 3 Stanje i fotke · 4 Potpisi`

⚠️ **`draftStep` menja značenje, a u bazi ima redova.** Provereno u lokalnoj bazi: nacrti stoje na
koracima 2, 3 **i 5**. Zato:

- `INTAKE_WIZARD_STEP_COUNT`: 5 → **4**.
- Ulazna šema (`IntakeOrderUpdateInputSchema.draftStep`): `max(5)` → **`max(4)`**, da aplikacija
  više ne može ni da upiše peticu.
- **Čitanje sa žice nema gornju granicu** (`z.number().int().nullable()`), pa stari red sa peticom
  ne puca ni na jednom ekranu — provereno.
- Nastavak nacrta **spušta korak u opseg** (`Math.min(step, INTAKE_WIZARD_STEP_COUNT)`): ko je stao
  na potpisima (5) sleti na potpise (4), ko je stao na specifikaciji (4) sleti na potpise — jer
  specifikacije više nema, a to je sledeće što treba da uradi.
- **`CHECK (draft_step BETWEEN 1 AND 5)` u bazi OSTAJE.** Namerno: migracija koja sužava opseg mora
  i da prepiše postojeće redove, a dobija se samo uža provera na koloni koju aplikacija ionako više
  ne puni peticom. Zapisano kao svesna labavost, ne kao propust.

Traka koraka, „Korak N / 5" i provera dovršenosti čitaju konstantu, pa se povlače same.

---

## 4. Dokument izlazi sam

`finish()` danas potpiše nalog pa navigira na detalj. Sada navigira **sa zastavicom**:

- `IntakeDetailSearchSchema` dobija `stampa: z.boolean().optional()` (srpski, kao i `tab` — adresa
  je deo onoga što radnik vidi).
- Detalj na montiranju: ako je zastavica tu → otvara pregled štampe i **odmah je skida iz adrese**
  (`replace`), pa osvežavanje strane ne otvara pregled drugi put.
- Traka tabova šalje `search={{ tab }}` i time briše ceo objekat — što ovde radi u našu korist:
  prvi dodir taba ionako skida zastavicu.

⚠️ Otvara se **samo posle potpisa**, nikad na običan ulazak u nalog.

---

## 5. Redosled gradnje

1. **Lista se seli, korak se briše** — `intake-spec-list.tsx`, čarobnjak na 4 koraka, `draftStep`
   spuštanje i šema. Testovi: traka ima 4 koraka; nastavak sa 5 sleti na 4; detalj i dalje
   iscrtava svoj tab Specifikacije.
2. **Fotografije izlaze sa dokumenta** — blok, ključevi i kapija za slike. Testovi: list nema
   mrežu fotografija; broj i dalje stoji u redu sa ciframa i u pravnoj rečenici.
3. **Dokument izlazi sam** — zastavica, otvaranje, skidanje iz adrese. Testovi: sa zastavicom se
   otvara i adresa se očisti; bez nje se ne otvara.
4. **Izmeri pa predaj** — mutacije, prolaz kroz brauzer (pun krug prijema od prvog koraka do
   dokumenta u ruci), `docs/25`, dnevnik, push.

---

## 6. Šta ovo ne dira

Server (nijedna ruta, nijedna dozvola, nijedna migracija) · primopredaju · prava i role · kataloge ·
„+" stavke · prilog uz nalog · portal · reklamacije.
