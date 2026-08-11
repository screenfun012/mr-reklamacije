# Prijem vozila — dva „+", da radnik upiše ono što spisak ne nudi (C, dizajn)

**Datum:** 2026-08-11 · **Grana:** `feat/vehicle-intake` · **Osnova:** `bcce1d8`
**Status:** dizajn odobren po sekcijama (Nikola, 11.08.), odluka ⑱ obrnuta istog dana, kod nije počet

Deo **C** iz reda **A ✅ → B ✅ → H → G → C → D → E → F**.

⚠️ **Čita se posle H** (`2026-08-11-intake-freeze-after-signing-h-design.md`). H je poništio režim
izmene i time skinuo posao sa ovog speca na dva mesta — vidi odluku ⑱ i §6.

---

## 0. Odakle ovo dolazi

Nikola, 10.08., doslovno:

> **Plus dva „+"**: jedan na oštećenjima (slobodan tekst, npr. „felne izgrebane", kad radnik vidi
> nešto što nije u ponuđenom) i jedan na zatečenom stanju (dodatno zapažanje). Oba se čuvaju kao i
> postojeće stavke.

Prijem je dokaz o stanju vozila u trenutku predaje. Danas radnik može da upiše samo ono što spisak
nudi: osam stavki opreme i četiri tipa oštećenja na siluetu. Sve što vidi a spisak ne poznaje —
izgrebane felne, nedostajući poklopac, gumeni patosnici — nema gde da stane, pa **ne postoji na
papiru koji mušterija potpisuje.**

⚠️ **Nadređeno pravilo je `docs/25` §3.0** („ekran vodi, radnik se vozi"): radnici nisu računarski
pismeni i naći će svaku rupu. Zato se odluke ispod ne biraju po tome šta je fleksibilnije nego po
tome šta traži manje odluka od radnika.

---

## 1. Šta „+" pravi

**Na zatečenom stanju:** radnik ukuca naziv i dobije **isti DA/NE red** kao ostalih osam. Red živi
**samo na tom nalogu** — katalog ostaje adminov, drugi nalozi ga ne vide.

```
ZATEČENO STANJE                    3 / 9 potvrđeno
─────────────────────────────────────────────────
Rezervna guma          [ DA ] [ NE ]
Dizalica               [ DA ] [ NE ]
…
Lanci / alat           [ DA ] [ NE ]
Gumeni patosnici  ✕    [ DA ] [ NE ]   ← dopisano
                          [ + Dodaj stavku ]
```

**Na oštećenjima:** nedostatak **bez mesta na šemi**, u svom odeljku, bez brojčića — jer felne,
unutrašnjost i izduvni sistem se na siluetu ne mogu dodirnuti, a brojčić upućuje na crtež.

```
ŠEMA VOZILA          UOČENI NEDOSTACI  · 5
   ┌────────┐        ① Ogrebotina — hauba
   │  ①  ②   │        ② Udubljenje — zadnja leva strana
   │        │        ③ Rđa — prag desni
   │     ③  │
   └────────┘        OSTALO (bez oznake na šemi)
                      · felne izgrebane        ✕
                      · nedostaje poklopac     ✕
                          [ + Dodaj nedostatak ]
```

---

## 2. Odluke

| # | Pitanje | Odluka |
|---|---------|--------|
| ⑯ | Šta pravi „+" na zatečenom stanju? | **Nov DA/NE red, samo na tom nalogu.** Odbijeno: red koji ulazi u katalog za sve — to ruši razlog zbog kog G postoji („razdvojiti admina od operatera") i `docs/13` (katalog je adminov, interno samo čita). Odbijeno i: „to je već slobodan tekst" — „Napomena uz opremu" postoji, ali Nikola je tražio **stavku**, jer stavka nosi DA/NE i tako se pojavljuje na papiru. |
| ⑰ | Gde stoji „+" na oštećenjima? | **Nedostatak bez mesta na šemi**, u odeljku „OSTALO", bez brojčića. Odbijeno: marker sa svojim opisom i napomena na postojećem markeru — nijedno ne pokriva felne, koje su bile Nikolin primer. |
| ⑱ | Radi li „+" i posle potpisa? | **NE — odluka obrnuta istog dana** (Nikola, 11.08.). „+" radi **samo u čarobnjaku**, dok nalog nije potpisan. Prvo je bilo „da, kroz režim izmene", a onda je Nikola postavio nadređeno pravilo: potpis zamrzava zapis, jer vlasnik u ruci drži papir i neslaganje je konflikt. Time je poništen ceo režim izmene (V-6-2) — svoj deo, **`docs/superpowers/specs/2026-08-11-intake-freeze-after-signing-h-design.md`**, koji ide **pre** C. |
| ⑲ | Počinje li „Napomena uz opremu" da se štampa? | **Ne u ovom zahvatu** (Nikola, 11.08.). ⚠️ Posledica koju treba znati: papir će nositi dopisane DA/NE redove, a slobodan tekst iz istog polja neće. Ostaje prijavljeno, §8. |
| ⑳ | Može li fotografija na „ostalo"? | **Ne.** Fotografija se veže preko `damageId`, a red bez markera ga nema. Slika izgrebanih felni ide kao **opšta fotografija** — ta ćelija već postoji na koraku 3. Vezivanje bi tražilo `id` po redu i granu u vezivanju slika, za stvar koja već ima put. |
| ㉑ | Računa li brojka „NEDOSTACI · N" i „ostalo"? | **Da**, i na ekranu i na papiru. Inače list piše „3" a lista ispod ima 5 — laž na dokumentu koji je dokaz. |
| ㉒ | Šta piše na engleskom listu? | **Naziv kako je ukucan**, na oba jezika. Radnika ne mogu da pitam za prevod — to je tačno ono što §3.0 zabranjuje. Svesna cena, ista klasa kao G-ovo „nova kataloška stavka bez engleskog naziva". |
| ㉓ | Menja li se naziv posle dodavanja? | **Ne.** Pogrešan → ✕ i ponovo. Polje za izmenu naziva na potpisanom nalogu je treći način da se dokaz tiho prepiše. Isti naziv dva puta **se ne brani** — dva ista reda su vidljiva greška koju radnik skloni jednim dodirom, a zabrana bi tražila pravilo koje neko mora da razume. |

---

## 3. Model podataka

Dve nove kolone na `intake_orders`, migracija **`0038`**:

| Kolona | Oblik | Nosi |
|---|---|---|
| `extra_checklist` | `jsonb NOT NULL DEFAULT '[]'::jsonb` → `[{ name, value }]` | stavke koje radnik dopiše, sa DA/NE/nedirnuto |
| `extra_damages` | `jsonb NOT NULL DEFAULT '[]'::jsonb` → `string[]` | nedostaci bez mesta na šemi |

**Postojeći redovi se ne diraju** — podrazumevana vrednost im daje `[]`. Migracija se generiše
`drizzle-kit`-om, nikad rukom, i lanac od nule se dokazuje pre primene.

### 3.1 Zašto ne u postojeće kolone

**`checklist` ne može.** Ona je `{kod: DA/NE}`, a po odluci ⑭ iz G **server odbija kod koji nije u
katalogu**. Dopisana stavka nema kod i ne sme da ga dobije — u trenutku kad ga dobije, katalog je
prestao da bude adminov.

**`damages` ne bi trebalo.** Ona traži `x`, `y`, `zone`, `type`. Da nedostatak bez mesta stane tu,
te tri stvari bi morale da smeju da budu prazne, pa bi **stražu za praznu vrednost trebalo dodati na
pet mesta**: crtež, brojevi ①②③, markeri na papiru, vezivanje fotografije, i serverovo ponovno
izvođenje zona kad se promeni tip vozila (`intake-orders.service.ts:398-410`). Dve kolone su manji
ukupan zahvat od pet straža, a `damages` ostaje tačno onako jak kakav je danas.

### 3.2 Oblici (`@mr/shared`)

```ts
export const IntakeExtraChecklistItemSchema = z.object({
  name: z.string().trim().min(1).max(80),   // 80 = koliko staje u jedan red na papiru
  value: z.boolean().nullable(),            // treće stanje ostaje: nedirnuto ≠ „nema"
})
export const IntakeExtraChecklistSchema = z.array(IntakeExtraChecklistItemSchema).max(100)
export const IntakeExtraDamagesSchema = z.array(z.string().trim().min(1).max(200)).max(100)
```

`extra_damages` je `string[]` **jer to nije nov oblik u ovoj tabeli** — `services` i `materials` su
već `string[]` sa `.max(100)` na listi i `.max(200)` na stavci. Ista ograničenja, ništa novo da se
izmišlja i objašnjava.

Bez `id` po redu, namerno: red ne nosi ništa što bi na njega upućivalo — fotografija ne (odluka ⑳),
a posle potpisa se liste ne menjaju uopšte (odluka ⑱).

⚠️ **`.max(100)` sa žice i kapa na papiru su DVA razna broja i ne mešaju se.** `.max(100)` brani da
pozivalac upiše smeće u red baze; kapa na papiru je pitanje da li strana staje i **određuje se
merenjem** (§5). Kapa na papiru će biti manja, i to je u redu — ono što ne staje nosi natpis „…i još
{count}", a u nalogu stoji sve.

---

## 4. Ekrani

**Korak 2 — Zatečeno stanje** (`wizard/step-checklist.tsx`, `wizard/intake-checklist-grid.tsx`).
Dopisane stavke stoje **ispod** kataloških, isti DA/NE red, samo one imaju ✕. Pod mrežom
`+ Dodaj stavku` → red sa poljem za naziv → „Dodaj" ili Enter. Polje se posle dodavanja **prazni i
ostaje otvoreno**, jer radnik obično doda dve-tri odjednom.

⚠️ **Brojač `{confirmed} / {total}` čita katalog PLUS dopisane** — isti natpis
(`intake_checklist_confirmed`), drugi ukupan broj, **nikad literal**. Ista greška kao „Korak 2 / 5"
koju je brauzer našao u B, i ista koju G već čuva.

**Korak 3 — Stanje i fotke** (`wizard/step-damage-photos.tsx`). Pod numerisanom listom podnaslov
`OSTALO (bez oznake na šemi)`, redovi sa tekstom i ✕, pa `+ Dodaj nedostatak`. Brojka na kartici
računa markere i „ostalo" (odluka ㉑).

Podnaslov „OSTALO" se na ekranu **pojavljuje samo kad ima najmanje jedan red**, a dugme
`+ Dodaj nedostatak` stoji **uvek** — inače radnik ne bi imao gde da dodirne prvi put. Na papiru se
ceo podblok pojavljuje samo kad ima redova (§5).

**Detalj** (`detail/card-condition.tsx`, `detail/card-damages.tsx`). **Samo čitanje** — dopisano se
prikazuje na istom mestu i istim oblikom, da potpisan nalog na ekranu izgleda kao papir u ruci.
Nijedan „+" i nijedan ✕ ne postoje na detalju: po H, potpis zamrzava zapis (odluka ⑱).

**Nijedan nov dijalog.** ✕ postoji samo u čarobnjaku, gde nalog još nije potpisan, i briše odmah —
jedan dodir da se doda, jedan da se skloni, ništa da se potvrđuje.

Prazan naziv → „Dodaj" je zatamnjeno; **nema poruke o grešci**, jer nema šta da se objasni.

### 4.1 Novi natpisi (sr + en, parnost obavezna)

`intake_extra_add_item` · `intake_extra_add_defect` · `intake_extra_item_placeholder`
(„npr. Gumeni patosnici") · `intake_extra_defect_placeholder` („npr. felne izgrebane") ·
`intake_extra_confirm` („Dodaj") · `intake_extra_remove` (aria) · `intake_section_other_damages`
(„OSTALO (bez oznake na šemi)") · `intake_print_section_other_damages` („OSTALI NEDOSTACI" /
„OTHER DEFECTS").

⚠️ Posle izmene `messages/*.json` ide `pnpm --filter @mr/i18n run compile`, inače ekran mirno
prikazuje **stari** tekst i izgleda kao da izmena nije primenjena.

---

## 5. Papir

Dopisane stavke idu u istu sekciju ček-liste, istim redom. Nedostaci bez mesta dobijaju podblok
`OSTALI NEDOSTACI` / `OTHER DEFECTS`, **samo kad ih ima**, i **bez brojčića**.

⚠️⚠️ **Ovo je jedina prava tehnička opasnost u C.** List je već pun: V-7 je izmerio da 12
nedostataka u jednoj koloni daje **1247px prema fiksnih 1123** i odnese podnožje sa oba potpisa na
drugu stranu. Zato:

- **kape se ne pogađaju nego mere u brauzeru na najgorem slučaju**: 12 markera + dopisani nedostaci
  + ček-lista sa dopisanim stavkama + duga primedba + 5/5 usluga i materijala (oznaka izmene više ne
  postoji — H je briše)
- ostatak nosi natpis koji **već postoji** — `intake_print_damages_more`
  („…i još {count} — vidi digitalni nalog {number}"). Jedna rečenica, bez blizanca: kad prelivaju i
  markeri i „ostalo", `{count}` je **njihov zbir**, jer papir govori mušteriji koliko nedostataka
  nije stiglo na list, a ne u kojoj su listi bili.
- ⚠️ Zamka iz V-7 ostaje: podnožje je `mt-auto`, pa `scrollHeight === clientHeight` **uvek** važi kad
  staje — zaliha se iz toga ne čita, samo binarno staje/ne staje.

---

## 6. Server

- ulazna šema (`intake-order.wire.schema.ts`) i šema za čitanje dobijaju dve nove stavke iz §3.2
- **ništa više.** Posle H jedini spisak u servisu je `FREE_AFTER_SIGNING = ['services', 'materials']`,
  a sve što nije u njemu je posle potpisa odbijeno **na ime polja**. Dve nove kolone su zamrznute time
  što nisu na tom spisku — **bez ijedne nove straže, bez nove dozvole, bez novog prelaza u Istoriji,
  bez promene SSE-a.**

⚠️ Ovo je drugi put da H skida posao sa C-a: pre H su ovde stajale **dve nove uporedbe** (da zahtev
koji ne menja ništa ne udari žig). Bez žiga nemaju čemu da služe, a `intake-condition-equal.ts` H
briše ceo.

---

## 7. Šta se mora dokazati

Merenjem u brauzeru:
- najgori slučaj sa §5 **staje na jednu stranu**, sa oba potpisa u podnožju

Testovima (svaki mora da padne kad se linija koju pokriva pokvari — mutacija, ne argument):
- ukupan broj u brojaču raste sa dopisanom stavkom (ne literal)
- „ostalo" ulazi u brojku nedostataka na ekranu i na papiru
- patch dopisanih lista na **potpisan** nalog → **odbijen** (H, odluka ⑱) — bez izuzetka, i za admina
- prazan/beli naziv se ne dodaje
- dopisana stavka bez odgovora se štampa kao nedirnuta, ne kao „nema"
- „ostalo" red se štampa **bez** brojčića

---

## 8. Granice

**Ulazi u C:** brisanje mrtvog polja `note` sa markera (`IntakeDamageSchema.note`) — deklarisano do
500 znakova, nikad upisano, pročitano ni odštampano, i stoji u istoj šemi koju C menja.
`CLAUDE.md` §6 zabranjuje mrtav kod.

**Prijavljeno, ostaje nedirnuto:**
- „Napomena uz opremu" se ne štampa (odluka ⑲) — polje postoji od V-5, izmenjivo je posle potpisa,
  vidi se na detalju, ali ga `buildIntakePrintModel` ne nosi
- `IntakeDamagesSchema` **nema `.max()`** — niz markera sa žice je neograničen
- `services`/`materials` se štampaju **bez ijedne kape** (`intake-print-damages.tsx:106-120`) — ista
  opasnost za stranu, zatečena

**Zavisi od G1** po dogovorenom redu: dopisane liste rade i bez njega, ali ukupan broj tada čita
konstantu `INTAKE_CHECKLIST_KEYS.length` umesto kataloga.

**Nije u C:** promene kataloga (G), razdvajanje admina i operatera (D), prilog uz nalog (E),
primopredaja (F).

---

## 9. Faze

| Faza | Sadržaj | Kraj |
|---|---|---|
| **C-0** | migracija `0038` (dve kolone) + šema u `@mr/db` | ⚠️ **traži izričito odobrenje pre primene**; dokazan lanac od nule |
| **C-1** | `@mr/shared` (šeme + dve uporedbe) · api (`CONDITION_FIELDS`, validacija) · brisanje mrtvog `note` | gejt zelen, komit |
| **C-2** | čarobnjak: korak 2 i korak 3 | gejt zelen, komit |
| **C-3** | detalj: čitanje (samo čitanje — H je sklonio režim izmene) | gejt zelen, komit |
| **C-4** | papir + **merenje najgoreg slučaja** | gejt zelen, komit |

Pun gejt pre svakog komita. Komit samo kad je faza cela.
