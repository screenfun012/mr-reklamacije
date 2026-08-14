# Prijem vozila — primopredaja i drugi dokument (F, dizajn)

**Datum:** 2026-08-15 · **Grana:** `feat/vehicle-intake` · **Osnova:** `9dc9729`
**Status:** PREDLOG — nije odobren, kod nije počet

Deo **F** iz reda **A ✅ → B ✅ → H ✅ → G ✅ → C ✅ → D (odložen) → E → F**.

⚠️ **D je odložen na Nikolin zahtev** (rolovi; njegove reči su u `docs/03-permissions.md`), pa F ide
pre njega. F ne traži nijednu novu rolu — koristi `intake_orders.advance` i
`intake_orders.change_status`, obe već postoje.

---

## 0. Zašto

Modul je danas **polovina petlje.** Vlasnik potpisuje kad vozilo uđe i izlazi sa odštampanim papirom.
Kad vozilo izađe — ništa. Firma ima dokaz šta je primila i nijedan dokaz šta je vratila, a to je
tačno ona izloženost zbog koje dokument o prijemu i postoji.

Nikola, 11.08., doslovno:

> „drugi dokument […] treba da sadrzi podatke iz prvog dokumenta kao i podatke nakon toga, znaci
> celukupnost o vozilu […] sve mora da bude na tom dokumentu da vlasnik je upoznat sa svime i
> potpisao da je saglasan i da uzima vozilo."

Spor koji očekuje je konkretan: auto se pokvari posle preuzimanja i vlasnik kaže *„ja ne znam šta ste
radili na njemu"* — odgovor je specifikacija radova na papiru koji je potpisao. Ili vlasnik na
preuzimanju kaže *„ja nemam to i to"* iako ima, i potpisao je za to pre nego što je odvezao auto.

---

## 1. Gde F sleće

Statusni model **već ima kraj**: `primljeno → u_radu → gotovo → preuzeto`, `preuzeto` je terminalno i
server odbija dalji pomak sa 409. Danas je prelaz na `preuzeto` **jedan klik uz potvrdu**.

F taj klik pretvara u primopredaju. Ništa u nizu statusa se ne menja — menja se samo šta se mora
dogoditi da bi se stiglo do poslednjeg.

---

## 2. Odluke

| # | Pitanje | Odluka |
|---|---------|--------|
| ① | Sme li `preuzeto` bez papira i potpisa? | **Sme, ali se vidi.** Primopredaja je normalan put; postoji izlaz „predato bez potpisa" koji nalog trajno nosi na sebi i na spisku. ⚠️ **Ovo je Claude-ov predlog, ČEKA Nikolinu reč.** Razlog je isti kao kod praznog kataloga (12.08.): kad se zapis i dvorište raziđu, radnici prestanu da koriste sistem. Vlasnik koji dođe u 19h kad je serviser otišao mora nekako da odveze auto. Odbijeno: tvrda brava — jača je na papiru, ali proizvodi naloge koji stoje „gotovo" dok auto nije u dvorištu. |
| ② | Kako se izlaz pamti? | **Ne pamti se novom kolonom.** `status = preuzeto` uz `handover_signed_at IS NULL` JESTE taj zapis, pa se dva podatka ne mogu razići. Ko i kada — to audit već piše, kao za svaku promenu stanja. |
| ③ | Ko sme na izlaz? | **`intake_orders.change_status`** (operater + admin), dok primopredaja sa potpisima ide na `intake_orders.advance`. Prečicu tako uzima nadređeni, ne serviser pod pritiskom. Nema nove dozvole. |
| ④ | Ko potpisuje? | **Onaj ko predaje + vlasnik.** Ne nalogov serviser: predaje onaj koji tu stoji, a papir mora da imenuje njega. Dokument 1 imenuje radnika koji je primio, iz istog razloga. |
| ⑤ | Šta nosi dokument 2? | **Sve iz dokumenta 1, plus sve posle njega** (§3.5 `docs/25`): specifikacija radova i materijal. Potpisi **poslednji**, jer se potpisuje celina. |
| ⑥ | Koliko strana? | **Koliko treba.** Nikola, 11.08.: jedna kad staje, pa druga, pa treća. **Ništa se ne krati i nema „…i još N — vidi nalog"** — poenta je da ništa ne nedostaje, a izostavljeno je prvo za šta nezadovoljan vlasnik posegne. |
| ⑦ | Ulaze li fotografije? | **Ne** — nasleđeno pravilo od 13.08. Dokument 2 nosi sve što nosi dokument 1, a fotografije nikad nisu bile na njemu. |
| ⑧ | Šta kad specifikacija nije upisana? | **Ne blokira.** Auto se predaje, a odeljak na papiru nosi rečenicu da radovi nisu zabeleženi. Ista logika kao prazan katalog: to je greška kancelarije i ne sme da zaustavi vlasnika u dvorištu — a rečenica na papiru je dokaz da nije zaboravljeno nego da nije bilo. |
| ⑨ | Šta sa nalozima koji su već `preuzeto`? | **Ništa.** Nikola, 15.08.: *„sve što je u servisu su test nalozi."* Nema migracije za stare redove i nema izuzetka za njih. |
| ⑩ | Ide li dokument 2 vlasniku na mejl? | **Da**, istom mašinom kao dokument 1 (D-0..D-5): peče se jednom na potpis, šalje se pročitan fajl iz skladišta, kancelarija ga skida i može ponovo da pošalje. Bez adrese → ništa se ne šalje, dokument se svejedno napravi. |

---

## 3. Model podataka

Šest kolona na `intake_orders`, **ogledalo postojećih šest za prijem** — ta simetrija JE dizajn:

| Kolona | Ogledalo od | Nosi |
|---|---|---|
| `handover_technician_signature` | `technician_signature` | SVG putanja u 460×200 prostoru |
| `handover_owner_signature` | `owner_signature` | isto |
| `handover_signed_at` | `signed_at` | NULL = primopredaja nije potpisana |
| `handover_document_storage_path` | `document_storage_path` | zapečaćen fajl, `intake/<id>/handover.pdf` |
| `handover_document_sha256` | `document_sha256` | SHA-256 upisanih bajtova |
| `handover_document_emailed_at` | `document_emailed_at` | kad je stigao vlasniku |

Sve nullable, bez podrazumevanih vrednosti, bez popune postojećih redova — NULL je istina o njima, a
ne rupa (isti obrazac kao `document_storage_path` od 13.08.).

⚠️ Migracija se generiše `drizzle-kit`-om, nikad rukom, i lanac od nule se dokazuje pre primene.
Broj se čita iz `meta/_journal.json` u trenutku pisanja — **ne upisuje se ovde**, jer je spec od
11.08. rekao „migracija 0038" i pogrešio, pošto je 0038 u međuvremenu otišla na `contact_phone`.

---

## 4. Drugo zamrzavanje

Pravilo je Nikolino od 11.08.: **potpisi prijema zatvaraju sve što je radnik uneo · potpisi
primopredaje zatvaraju i Specifikaciju.** Između njih Specifikacija ostaje živa, jer serviser mora da
SME da ukloni materijal koji mu ne treba.

Danas je to jedna lista, `FREE_AFTER_SIGNING = ['services', 'materials', 'contactPhone']`. Postaje
funkcija stanja, jedna i jedina, na istom mestu:

| Stanje | Slobodno |
|---|---|
| pre potpisa prijema | sve |
| posle potpisa prijema | `services`, `materials`, `contactPhone` |
| **posle potpisa primopredaje** | **`contactPhone`** |

`contactPhone` preživljava oba zamrzavanja namerno: to je radna beleška kancelarije koja se **nikad ne
štampa**, i potreba da se ispravi pogrešan broj ne prestaje kad auto ode.

⚠️ Odbijanje i dalje ide na **IME polja, nikad na vrednost** — orezivanje ključa zato što je jednak
sačuvanom bi „pošalji ponovo sa istom vrednošću" pretvorilo u put pored zamrzavanja.

---

## 5. Dokument 2 nije viši dokument 1

Dokument 1 je **kutija tačnih mera**: `794px × 1123px`, `flex`, podnožje prikucano za dno. Dokument 2
**teče**, pa ne može biti isti list sa većom visinom — to je druga komponenta u istom paketu
(`@mr/intake-document`), sa `@page` i marginama, kao izveštaj o reklamaciji.

Iz toga slede tri stvari koje treba izmeriti, ne pretpostaviti:

1. **Zaglavlje se ne ponavlja samo.** Chromium ne podržava `position: running()`. Ili zaglavlje ide
   samo na prvu stranu, ili se koristi `headerTemplate`/`footerTemplate` iz `page.pdf()` — a
   `PdfRenderer.renderDocument` ih danas ne prosleđuje. **Odluka se donosi nad izmerenim listom.**
2. **Broj strane** („2 / 3") je jedini način da vlasnik zna da ima još — a bez njega izgubljena strana
   je nevidljiva. Ide u isti `footerTemplate`.
3. **Potpisi ne smeju da se prelome** od naslova. `break-inside: avoid` je u flex rasporedu dokazano
   nepouzdan (`docs/25`), pa se blok potpisa meri na listi koje se prelamaju baš na tom mestu.

Ostalo se ne izmišlja ponovo: isti `PdfRenderer` iz `core/pdf`, isti omotač sa ugrađenim fontovima i
amblemom, `printBackground: true`, `preferCSSPageSize: true`, isti `documentsBeingSealed` da jedan
nalog ima jedan let.

---

## 6. Ekran

Prelaz `gotovo → preuzeto` više nije dugme sa potvrdom nego **ekran primopredaje** — jer se na njemu
potpisuju dva čoveka, a dijalog sa dva potpisna polja i celim računom o vozilu nije dijalog.

Nosi, odozgo nadole: šta je primljeno (zatečeno stanje, gorivo, nedostaci — isto što je vlasnik
potpisao) · šta je rađeno (specifikacija i materijal) · dva potpisna polja · **PREDAJ VOZILO**.
Ispod, tiho i odvojeno, **„Predato bez potpisa"** — vidi ga samo `change_status`, i ide kroz
`<ConfirmDialog>` koji imenuje posledicu: nalog će trajno stajati bez potpisanog dokumenta.

Podnožje se ponaša kao u čarobnjaku: **dugme koje ne radi mora da kaže zašto** (`docs/25` §3.0, i
popravka od 15.08. na koraku 1 — rečenica imenuje ono što FALI, ne fiksni spisak).

---

## 7. Šta F NE radi

- **Ne dira rolove** (deo D) — ni „serviser vidi sva vozila".
- **Ne dira cene ni fakturisanje** — van opsega modula od početka.
- **Ne dodaje fotografije na papir** (odluka ⑦).
- **Ne otvara ponovo potpisan prijem.** Dokument 1 ostaje tačno onakav kakav je vlasnik potpisao;
  dokument 2 ga citira, ne prepravlja.
- **Ne pravi put nazad iz `preuzeto`.** Ostaje terminalno.

---

## 8. Otvoreno, čeka Nikolu

1. **Odluka ① — tvrda brava ili vidljiv izlaz.** Sve ostalo u ovom specu stoji i u jednom i u drugom
   slučaju; menja se samo §6 (da li „Predato bez potpisa" uopšte postoji) i odluka ③.
2. **Da li dokument 2 nosi i „Obaveze kupca"** — pravni blok koji dokument 1 ima u podnožju. Nije
   pitanje izgleda nego šta vlasnik potpisuje drugi put.
