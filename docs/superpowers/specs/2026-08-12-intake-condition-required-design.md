# Zatečeno stanje je obavezno — dizajn

**Datum:** 2026-08-12
**Grana:** `feat/vehicle-intake`
**Prethodi mu:** G1 katalog ček-liste (`cf27609..6f2cbc7`), deo H — potpis zamrzava zapis
**Status:** odobreno (Nikola, 12.08.2026), kod nije počet

---

## 1. Zašto

Nikolino pravilo, njegovim rečima:

> „Ne sme traka nikada da bude prazna. Ako nije popunjeno u tom trenutku ne može da se ide dalje
> i stojaće onaj status nastavi sa prijemom vozila što već imamo. To mora da se popuni jer te tri
> stavke se popunjavaju dok je stranka (vlasnik) tu, jer mora na kraju da se potpiše i dobije
> papir. Ne može da se preskoči ili ostavi za kasnije jer auto se prima tada i mora da se
> evidentira."

Ček-lista je danas potpuno neobavezna — nema kapije ni na ekranu ni na serveru, pa nalog sme da
stigne do potpisa sa nedirnutom listom. Vlasnik tada potpisuje papir na kome o stanju vozila ne
piše ništa, a taj papir je jedini dokaz ako kasnije kaže da je dizalica bila u gepeku.

## 2. Šta je provereno u kodu (a ne pretpostavljeno)

Dve stvari menjaju kako pravilo mora da se sagradi:

1. **Traka na papiru danas nikad nije doslovno prazna.** Nalog se pri kreiranju puni sa
   `untouchedIntakeChecklist(catalog)` — svaka stavka kataloga ima svoj red, nedirnuta štampa `—`
   (`intake-checklist-catalog.ts:63`, `intake-print-condition.tsx`). Znači ne dobija se prazna
   traka nego traka puna crtica: **izgleda popunjeno, a ne tvrdi ništa.** To je stanje protiv kog
   pravilo zapravo radi.
2. **Napomena o opremi se ne štampa.** `equipmentNote` postoji u čarobnjaku
   (`step-checklist.tsx`) i na ekranu naloga (`detail/card-condition.tsx:95`), ali ga list papira
   ne čita uopšte. Da je ostavljena tako, radnik bi mogao da zadovolji ekran napomenom a vlasnik
   bi dobio papir na kome i dalje ne piše ništa.

Ostalo zatečeno stanje, korisno za gradnju:

- Ček-lista je `{kod: true | false | null}`; **`null` je vrednost „nedirnuto", ne odsustvo**
  (`packages/shared/src/schemas/intake-order.schema.ts:39`) — nepopunjeno se tačno broji.
- Brava koju treba proširiti već postoji: `forwardDisabled` (`wizard/intake-wizard.tsx:351`) drži
  DALJE mrtvo na koraku 1, a podnožje već ume da kaže zašto (`hint.text` / `hint.tone` →
  `intake-wizard-footer.tsx`).
- `IntakeOrdersService` već drži katalog (`checklistCatalog: IntakeChecklistCatalogPort`,
  `intake-orders.service.ts:133`), ali taj port ume samo `listKnownCodes()` — **svaki kod koji je
  katalog ikad držao, namerno bez filtera na ugašeno i obrisano** (`intake-checklist-items.repository.ts:97`).
  To je pogrešan broj za ovu bravu: katalog u kome su sve stavke ugašene i dalje vraća kodove. Port
  dobija još jednu metodu (§4.2).
- `clipRemarks` (`print/intake-print-data.ts:98`) već seče dugačak tekst na meru lista.

## 3. Pravilo

**Zatečeno stanje je zabeleženo** ako je ispunjeno bilo šta od:

- bar jedna stavka ček-liste ima **DA** ili **NE**, ili
- **napomena o opremi** nije prazna (posle `trim`).

**Izuzetak:** ako katalog trenutno nema nijednu aktivnu stavku, prolazi bez ičega. (Nikolina
odluka: greška u administraciji ne sme da zaustavi prijem auta u dvorištu. Papir tada nosi
rečenicu „Ček-lista nije popunjena." kao dokaz da katalog tada nije imao stavke — što od danas
prestaje da bude normalan ishod i postaje mreža za tuđu grešku.)

**Odgovorena stavka koju je kancelarija u međuvremenu ugasila i dalje vredi.** Nalog je i dalje
štampa sa njenim imenom (`ecd3ab3`), znači papir nešto tvrdi, znači pravilo je ispunjeno.

Iz toga sledi da provera **ne mora da poznaje katalog po kodovima** — samo da li katalog danas ima
išta da se popuni.

### Jedna funkcija, jedno mesto

`packages/shared/src/utils/intake-condition-recorded.ts` — pored `compute-domace-total.ts`, jedan
čist izraz po fajlu, kako je u tom folderu već običaj.

```ts
export function isIntakeConditionRecorded(
  checklist: IntakeChecklist,
  equipmentNote: string | null,
  activeCatalogItemCount: number,
): boolean
```

Zovu je **i ekran i server**. Nikad dve računice koje mogu da se raziđu.

## 4. Tri mesta gde se pravilo vidi

### 4.1 Ekran — DALJE je mrtvo na koraku Ček-lista

`forwardDisabled` (`intake-wizard.tsx:351`) dobija još jedan uslov, istog oblika kao postojeći
`canLeaveStep1`:

```
step === INTAKE_WIZARD_STEPS.Checklist && !conditionRecorded
```

Treći argument (broj aktivnih stavki) čarobnjak već ima — `checklistItems` se učitava sa
`activeOnly: true` (`intake-wizard.tsx:216`). Ništa se ne dovlači ponovo.

Podnožje kaže zašto — nova poruka u sr/en, u tonu upozorenja:
**„Označi bar jednu stavku ili upiši napomenu — vlasnik potpisuje ovaj papir."**

Pošto ček-lista dolazi **pre** potpisa, nedovršen nalog sam ostaje na statusu „nastavi sa prijemom
vozila" — mehanizam koji već postoji, tačno kako je Nikola tražio. Ništa novo se ne gradi za to.

### 4.2 Server — ista provera na potpisu

`IntakeOrdersService.sign()` (`intake-orders.service.ts:417`), pre nego što `repo.sign` zamrzne
zapis: pusti `isIntakeConditionRecorded` nad `before` i baci `ValidationError` (422) ako nije
zabeleženo.

Za treći argument port dobija jednu metodu — `countActiveItems(): Promise<number>`
(`core/ports/intake-checklist-catalog-port.ts`), u repozitorijumu `count(*)` uz `is_active = true`
i `deleted_at IS NULL`. **Ne sme se koristiti postojeći `listKnownCodes()`**: on namerno ne
filtrira ugašeno, pa bi katalog sa svim ugašenim stavkama i dalje izgledao pun i brava bi
zaključala prijem — tačno ono što je Nikola odbio. Metoda se poziva jednom po potpisu, dakle retko.

Razlog za drugu bravu: tablet se osvežava, `?resume=` postoji, a papir ne sme da zavisi od
pregledača. CLAUDE.md §2 — server je sudija, UI je ljubaznost.

Čarobnjak taj 422 ne mora posebno da lovi — ekranska brava ga čini gotovo nedostižnim, i pada na
postojeću putanju greške pri završetku. Poruka servera ostaje engleska, kako je u ovom
repozitorijumu red za domenske greške; radnik srpski tekst vidi iz podnožja (§4.1), ne iz servera.

### 4.3 Papir — napomena se štampa

`IntakePrintCondition` dobija napomenu **ispod kvačica, unutar trake ZATEČENO STANJE**, iznad reda
sa gorivom/oštećenjima/fotografijama. Skraćena kroz postojeći `clipRemarks` (list je fiksne visine
— duga napomena bi inače gurnula potpise sa strane).

Traži: `equipmentNote` u `IntakePrintModel` (`intake-print-data.ts:64`) i u preslikavanju na
`:143`.

Rečenica `intake_print_condition_empty` („Ček-lista nije popunjena.") od sada se prikazuje **samo
kad nema ni redova ni napomene** — dakle samo za prazan katalog. Ekranski blizanac
`intake_condition_empty` ostaje kakav jeste (`6f2cbc7`).

## 5. Posledice po postojeće naloge

- **Nedovršen nalog** bez ičega, kad ga neko nastavi, tražiće da se popuni. To je posledica
  pravila, ne izuzetak.
- **Već potpisani nalozi se ne diraju.** Brava stoji na potpisu, a potpisano je ionako zamrznuto
  (deo H).
- **Nema migracije, nema nove dozvole, nema promene na tabeli.** Pravilo je čitanje postojećih
  polja.

## 6. Provere

Svaka brava dobija test koji pukne ako se brava skine.

**`@mr/shared`** (`utils/__tests__/`) — sve grane pravila: prazan katalog prolazi · sama napomena
prolazi · napomena od samih razmaka ne prolazi · jedno DA prolazi · jedno NE prolazi · sve `null`
ne prolazi · ugašena-a-odgovorena stavka prolazi.

**Čarobnjak** (`wizard/__tests__/`) — DALJE mrtvo dok je korak Ček-lista prazan; oživi na prvi
dodir; oživi i na napomenu; nikad mrtvo kad je katalog prazan.

**API integracija** (`intake-orders.integration.test.ts`) — potpis odbijen sa 422 nad nedirnutim
nalogom, prihvaćen posle jedne stavke; prazan katalog potpisuje bez ičega. Uz to jedan test nad
`countActiveItems` da **ugašena i obrisana stavka ne broji** — to je razlika zbog koje postojeći
`listKnownCodes` nije mogao da se upotrebi.

**Štampa** (`print/__tests__/`) — napomena se pojavi u traci; duga napomena je skraćena; rečenica o
nepopunjenoj listi se vidi samo kad nema ni redova ni napomene.

Pravilo za mutacije iz ove grane važi i ovde: **zelen test ne dokazuje ništa dok se ne slomi red
koji pokriva.**

## 7. Šta ovaj dizajn NE dira

- Korak Šteta (fotografije) ostaje neobavezan — Nikolino pravilo je govorilo o ček-listi.
- Katalog u administraciji ostaje kakav jeste; poslednja stavka sme da se ugasi (odluka iz §3).
- Zum u pregledu štampe je zaseban, već odlučen posao (rečenica-uputstvo se briše, umesto nje
  dugme PRAVA VELIČINA / CELA STRANA) — gradi se i komituje u istom naletu, ali nije deo ovog
  pravila.
