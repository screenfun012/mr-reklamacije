# Prijem vozila — potpis zamrzava zapis (H, dizajn)

**Datum:** 2026-08-11 · **Grana:** `feat/vehicle-intake` · **Osnova:** `a057f66`
**Status:** pravilo odobreno (Nikola, 11.08.), tri čitanja potvrđena, kod nije počet

Nov deo **H**, i ide **prvi**: red je **H → G → C → D → E → F**.

---

## 0. Odakle ovo dolazi

Nikola, 11.08.:

> Ako je radnik primio vozilo popunio sve potpisali se i istampao se dokument onda ti podaci se
> više ne diraju. Ako serviser radi na autu pa primera radi uzeo je deo materijal ali mu ipak ne
> treba mora da može da ga ukloni naravno. Ali ako je vozilo u statusu preuzeto […] i potpisali se
> serviser i vlasnik da je vlasnik preuzeo vozilo, onda nakon toga nema šta da se edituje.

Razlog je njegov i jedini koji je potreban: **vlasnik u ruci drži parče papira.** Ako kod nas piše
drugo, to je konflikt sa čovekom koji je nešto potpisao — i osnov da nezadovoljan vlasnik podnese
reklamaciju protiv sopstvenog dokaza.

⚠️⚠️ **Ovo poništava V-6-2 (režim izmene), sagrađen 10.08.** Ta funkcija je izrasla iz Nikoline
odluke ① od 08.08. („telefon SME da se ispravi posle potpisa, uz žig") i na isti rizik je odgovorila
**dozvoli, ali glasno** — dijalog doslovno piše „Mušterijin odštampani primerak više neće biti
identičan ovom zapisu". Nikola sada bira **ne dozvoli uopšte**. To je druga odluka, ne dopuna, i
zapisana je ovde da se za pola godine ne čita kao propust.

⚠️ **Zašto H ide PRVO, pre G i C:** G1 u svom spisku potrošača ima „detalj Zatečeno stanje — čitanje
**i režim izmene**", a C je imao odluku ⑱ („+" radi i posle potpisa). Ako se režim izmene prvo
skloni, **i G i C dobiju manje posla**; ako se skloni posle, oba ga sagrade pa se briše.

⚠️ **Cela grana `feat/vehicle-intake` nije na `main` i nije u produkciji** (provereno 11.08.). Nema
ni jednog stvarnog naloga sa žigom, dozvola `intake_orders.amend` nikad nije zasejana u produkciji.
Ovo je najjeftiniji mogući trenutak za ovu odluku.

---

## 1. Pravilo

Dva zamrzavanja, svako o svoj par potpisa:

| Trenutak | Zamrzava se | Ostaje živo |
|---|---|---|
| **Potpisi prijema** (radnik + vlasnik) → `signed_at` | vozilo, vlasnik, telefon, ček-lista, gorivo, oštećenja, dopisane stavke (C), napomena uz opremu, fotografije prijema | **Specifikacija** (`services`, `materials`) — dodavanje **i uklanjanje** · merdevine statusa · odbacivanje **nacrta** (tvrdo brisanje, kao danas) |
| **Potpisi primopredaje** (serviser + vlasnik, status Preuzeto) | **sve, uključujući Specifikaciju** | ništa |

Drugo zamrzavanje **fizički sleće sa F**, jer potpisi primopredaje tada prvi put postoje. Pravilo se
zapisuje sada da F ne bi bio treći put kad se o istoj stvari odlučuje.

⚠️ „Sve" u drugom redu **uključuje i status**: potpisana primopredaja se ne vraća unazad. Status je do
tada slobodan u oba smera (ispravka pogrešno kliknutog statusa je danas dozvoljena i ostaje), ali
Preuzeto sa potpisima je poslednji red — inače bi zapis o preuzimanju mogao da se poništi posle što ga
je vlasnik potpisao.

---

## 2. Odluke

| # | Pitanje | Odluka |
|---|---------|--------|
| ㉔ | Šta zamrzava — potpis ili štampa? | **Potpis** (`signed_at IS NOT NULL`). Nikola je rekao „potpisali se i istampao se dokument"; to je opis niza, ne drugi uslov. Da zamrzavanje čeka štampač, radnik koji ne dodirne „Štampaj" bi i dalje smeo da menja — rupa iste vrste koju zatvaramo. |
| ㉕ | Ima li izuzetka za admina? | **Nema.** Zamrzavanje sa izuzetkom nije zamrzavanje. Presuđuje **server**, ne ekran — kao i sve drugo u ovom repou. |
| ㉖ | Šta sa kodom režima izmene? | **Briše se**, ne ostavlja ugašen. `CLAUDE.md` §6 zabranjuje mrtav kod, a ugašena kapija je tačno ono što se posle ne ume objasniti. |
| ㉗ | Sme li potpisan nalog da se briše? | **Ne.** Brisanje ostaje samo za nedovršene nacrte. Ako se potpisan zapis sme obrisati, zamrzavanje podataka je slabije od brisanja celog dokaza — veća rupa od one koju zatvaramo. |
| ㉘ | Dokle je Specifikacija živa? | Do **primopredaje**. Serviser dodaje i **uklanja** — Nikolin primer: uzeo materijal pa mu ne treba. Ovo se ne menja u H; `FREE_AFTER_SIGNING` već tako radi. |
| ㉙ | Zakašnjele fotografije? | **Primaju se, ali samo do `photos_expected`.** Vidi §4 — ovo je moja preporuka i jedina stvar u H koja **dodaje** stražu umesto da je briše. |
| ㉚ | Pogrešan telefon vlasnika? | **Zamrznut, kao sve ostalo.** ⚠️ Cena je Nikolina sopstvena rečenica od 08.08.: telefon je „kako radnja dolazi do vlasnika auta koji drži", i pogrešan broj čini zapis neupotrebljivim za svoju svrhu. Vidi §5 — aditivni izlaz koji ne pravi neslaganje postoji i **čeka Nikolinu reč**. |

---

## 3. Šta se briše

**Server** (`apps/api/src/modules/intake-orders/intake-orders.service.ts`):

- `CONDITION_FIELDS` (:69) i `CONTACT_FIELDS` (:77) → nestaju. **`FREE_AFTER_SIGNING` (:66) ostaje i
  postaje jedini spisak** — sve što nije u njemu je posle potpisa odbijeno na ime, ne na vrednost.
- `classifyPostSigningPatch` (:418-451) se svodi na jednu stražu: dotaknuto polje van
  `FREE_AFTER_SIGNING` → `ValidationError`. Kapija `intake_orders.amend` (:445) nestaje sa njom.
- `withoutUnchanged` (:463-480) → **cela metoda nestaje.** Postojala je samo da žig ne udari na
  zahtev koji ne menja ništa; bez žiga nema šta da se čuva.
- `updateTransition` (:91-104) ostaje, ali sa jednim ishodom: `spec_updated`. Dva prelaza žiga
  nestaju.
- `uploadPhoto` (:707-711) i `deletePhoto` (:785-788): kapija `amend` nestaje; brisanje fotografije
  posle potpisa je **odbijeno svima**, dodavanje po pravilu iz §4.
- `delete` (:600-618): grana za potpisan nalog (`softDelete`) → **odbijeno svima** (㉗). Grana za
  nacrt ostaje netaknuta.
- `amended_at` / `amended_by` se prestaju upisivati.

**`@mr/shared`:** dozvola `intake_orders.amend` iz `PERMISSIONS` i iz `OPERATOR_PERMISSIONS` ·
`packages/shared/src/utils/intake-condition-equal.ts` (`sameIntakeChecklist`, `sameIntakeDamages`) →
**ceo fajl nestaje**, jer su mu oba pozivaoca bila žig i njegov bafer.

⚠️ U razvojnoj i test bazi red za `intake_orders.amend` u `role_permissions` ostaje kao siroče.
**Nije potrebno čistiti** — niska prosto prestaje da se proverava. U produkciji nikad nije postojala.

**`apps/internal-web`:** `detail/intake-amend-bar.tsx` · `detail/use-intake-amend.ts` (+ njegov test)
· grane režima izmene u `detail/card-condition.tsx`, `detail/card-damages.tsx`, `detail/tab-photos.tsx`
· zaključavanje trake tabova dok režim traje · bedž „⚠ Menjano posle potpisa" i napomena uz potpise ·
marker u listi naloga · oznaka `⚠ NALOG JE MENJAN POSLE POTPISA` na papiru
(`print/intake-print-sheet.tsx`) · red „Zatečeno stanje menjano posle potpisa" i „Telefon vlasnika
izmenjen posle potpisa" u Istoriji.

**`@mr/i18n`:** oko 20 natpisa — `intake_amend_*` (13), `intake_amended_hint`,
`intake_detail_amended_badge`, `intake_detail_amended_by_unknown`, `intake_signature_note_amended`,
`intake_history_amended`, `intake_history_amended_contact`, `intake_print_amended`. Iz **oba** jezika,
pa `pnpm --filter @mr/i18n run compile`.

**Dokumentacija u istom zahvatu** (`CLAUDE.md` traži da pravilo i zapis putuju zajedno): `docs/25`
§3.0.1 i §5 · invarijanta u `CLAUDE.md` §2.

⚠️ **Spec za C je već ispravljen** (istim komitom kao ovaj dokument): odluka ⑱ je obrnuta na „„+" radi
samo u čarobnjaku", §6 je izgubio dve uporedbe, C-3 je postao samo čitanje. Nijedan dokument na disku
ne tvrdi poništeno ponašanje.

---

## 4. Fotografije — jedina straža koja se DODAJE

Danas: `isLateArrival = order.technicianId === actor.id` (:707). Nalogov sopstveni serviser sme da
otpremi fotografiju i posle potpisa — to nije izmena nego **dostava onoga što je tablet držao u
trenutku potpisa**, i bez toga pada obećanje iz `docs/25` §3.6 („nema mreže → nalog se čuva, slike
odlaze same").

⚠️ Ali ta kapija gleda **ko**, ne **kada**. Isti serviser bi nedelju dana kasnije mogao da doda
fotografiju štete nastale u radionici, na zamrznut zapis. Pod pravilom iz §1 to je rupa.

**Zatvara se brojem koji već postoji:** `photos_expected` je upisan u trenutku potpisa kao
„pristiglo + neisporučeno, uključujući neuspele" (V-5). Dakle:

> Posle potpisa se fotografija prima **samo od nalogovog servisera** i **samo dok
> `count(attachments) < photos_expected`.**

Kad zapis dobije sve što je u trenutku potpisa tvrdio da ima, vrata se zatvaraju sama. Straža je
serverska, čitljiva iz jednog izraza, i **tačno je široka koliko zapis kaže da nešto nedostaje** —
ni piksel više.

⚠️ Trajno izgubljena fotografija znači `count < photos_expected` zauvek, pa za taj nalog vrata ostaju
otvorena zauvek — ali samo za onoliko slika koliko fali, i samo njegovom serviseru. Traka „nisu sve
fotke stigle" i dalje govori istinu i dalje ostaje zauvek (odluka ⑧).

---

## 5. Telefon vlasnika — otvoreno, čeka Nikolinu reč

Pod pravilom iz §1 pogrešno ukucan telefon **ostaje pogrešan zauvek**, a radnja nema drugi način da
dođe do vlasnika: šetač se namerno ne upisuje u `customers` (`schema/intake-orders.ts`, komentar na
vrhu), pa broj živi samo na ovom nalogu.

To je jedini slučaj u H gde zamrzavanje šteti svrsi samog zapisa, i Nikola je to sam napisao 08.08.

**Aditivni izlaz koji ne pravi neslaganje** (moja preporuka): potpisani `owner_phone` se **nikad ne
prepisuje**, a radnja dobija **odvojenu kolonu za kontakt** (`contact_phone`, prazna po
podrazumevanoj vrednosti) koja se **ne štampa na potpisanom nalogu** i vidi se samo interno, uz
natpis „Broj na potpisanom nalogu: …". Papir i zapis ostaju identični — jer se ono što je potpisano
ne dira — a radnja ume da pozove vlasnika.

Bez toga: nalog sa pogrešnim brojem se ne može upotrebiti za ono zbog čega ima telefon.
**Ne gradim ništa od ovoga bez Nikoline reči** — H stoji i bez njega, sa telefonom zamrznutim.

---

## 6. Šta se mora dokazati

Svaki test mora da padne kad se linija koju pokriva pokvari (mutacija, ne argument):

- patch **svake** zamrznute grupe na potpisan nalog → odbijen: vozilo · vlasnik · **telefon** ·
  ček-lista · gorivo · oštećenja · napomena uz opremu · dopisane liste (kad C stigne)
- patch `services`/`materials` na potpisan nalog → prolazi, Istorija dobije `spec_updated`
- **uklanjanje** materijala sa potpisanog naloga prolazi (Nikolin izričit primer)
- **admin** (drži `ALL_PERMISSIONS`) je odbijen isto kao operater (㉕)
- brisanje potpisanog naloga → odbijeno; brisanje nacrta → radi kao danas
- fotografija od nalogovog servisera dok `count < photos_expected` → prolazi; **preko toga →
  odbijena**; od bilo koga drugog posle potpisa → odbijena; **brisanje** fotografije posle potpisa →
  odbijeno
- nijedna površina ne nudi izmenu na potpisanom nalogu — ni dugme, ni traka, ni bedž

⚠️ Postojeći testovi V-6-2 (žig, Istorija, bafer, `use-intake-amend`) **se brišu, ne prepravljaju.**
Test koji dokazuje ponašanje koje više ne postoji je gori od nepostojećeg testa.

---

## 7. Granice

**Nije u H:** drugo zamrzavanje na primopredaji (pravilo je zapisano, sleće sa **F**) · kolone
`amended_at`/`amended_by` se prestaju upisivati u H, a **migracija koja ih briše traži Nikolino
izričito odobrenje** i ide zadnja, kad ih više nijedan red koda ne čita · telefon (§5) · nov nalog
kao put za ozbiljnu grešku — nije traženo, i pod ovim pravilom ispravka i JESTE ta koja pravi
konflikt.

**Prijavljeno, nedirnuto** (iz speca za C, i dalje stoji): „Napomena uz opremu" se ne štampa ·
`IntakeDamagesSchema` nema `.max()` · `services`/`materials` se štampaju bez kape.

---

## 8. Faze

| Faza | Sadržaj | Kraj |
|---|---|---|
| **H-1** | server: jedna straža umesto mašinerije žiga · dozvola `amend` van `@mr/shared` · brisanje `intake-condition-equal.ts` · fotografije po §4 · brisanje potpisanog naloga odbijeno · `docs/25` + `CLAUDE.md` §2 | gejt zelen, komit |
| **H-2** | internal-web: traka i bafer režima izmene, bedž, napomena uz potpise, marker u listi, oznaka na papiru · natpisi iz oba jezika + `compile` | gejt zelen, komit |
| **H-3** | migracija koja briše `amended_at`/`amended_by` | ⚠️ **traži izričito odobrenje**; dokazan lanac od nule |

Pun gejt pre svakog komita.
