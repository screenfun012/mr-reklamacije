# Admin panel — izgled i kontrolna tabla

**Status:** predlog odobren u razgovoru 19.08.2026. Kod nije počet.
**Prethodi:** U-0…U-3 (paleta, traka, bočni meni, ekran ovlašćenja) — već na grani `feat/permission-holes`.
**Ne sadrži:** nijednu migraciju, nijednu novu dozvolu, nijednu promenu onoga **šta** ekran radi.

---

## 1. Zašto

Admin je jedina aplikacija koja nikad nije prerađena. U-1 i U-2 su mu dali boje i traku, ali je
Nikola 19.08. rekao da i dalje deluje „prazan" i „nije frendli": _funkcionalnost je tu, dizajn nije._
Na pitanje šta tačno bode odgovorio je **sve četiri ponuđene stvari**:

1. svaki ekran je gola tabela,
2. previše crvenog,
3. ekrani ne odgovaraju ni na šta,
4. prazan prostor i ritam.

To nije doterivanje nego preoblačenje, i radi se **pre spajanja u `main`** — spajanje znači deploj
na live, jer Railway gleda `main`.

## 2. Načelo — preseliti, ne izmisliti

**Admin ne dobija nov dizajn. Dobija jezik koji internal-web već nosi i koji je Nikola odobrio.**

To je odluka protiv alternative (nacrt kod „Claude Design" pa integracija, kako je rađeno za portal
i internal). Ovde ta alternativa ne vredi ništa: model je na ekranu pored, radi, i njegov je. Svaki
sat proveden u smišljanju novog izgleda za admin je sat proveden u pravljenju **treće** dijalekta u
istoj kući.

⚠ Iz toga sledi pravilo koje važi za ceo posao: **gde god postoji internal-ov ekvivalent, kopira se
njegova mera, ne procenjuje se novom.** Ako se za neki element ne nađe uzor u internal-u, to je
znak da element verovatno ne treba da postoji.

## 3. Šta je već plaćeno a baca se

Najvažniji nalaz revizije, i on menja veličinu posla:

**Admin već povlači ceo `GET /api/dashboard/summary`** — isti odgovor koji internal koristi za svoju
početnu — pa prikaže **dva polja od pet** i ostalo baci.

| Polje odgovora | Internal | Admin danas |
| --- | --- | --- |
| `stats` | pločice | 4 broja ✅ |
| `trends` | strelica na pločici | jedna strelica ✅ |
| `recent` | kartica „Najnovije reklamacije" | **baca se** |
| `overdue` | kartica „Najduže otvorene" | **baca se** |
| `chart` | grafikon po mesecima | **baca se** |

Znači tri četvrtine kontrolne table **ne traži nijedan novi upit** — samo iscrtavanje onoga što
server već šalje i za šta se već čeka.

## 4. Deo A — trinaest ekrana sa tabelama

Uporedno čitanje `internal /reklamacije` i `admin /settings/departments` daje spisak razlika koje su
merljive, ne stvar ukusa:

| Internal | Admin danas | Koju od četiri primedbi rešava |
| --- | --- | --- |
| Filteri u **svojoj oivičenoj kartici** | pretraga i filter goli na stranici | ritam |
| Kartica spiska ima **zaglavlje: naslov + broj** („Lista reklamacija · 119 reklamacija") | tabela počinje bez uvoda | gola tabela |
| Radnje u redu su **ikonice** (oko, kanta) | dugmad sa tekstom; 13 punih crvenih „Deaktiviraj" niz ekran | **previše crvenog** |
| Stranice **unutar** kartice | ispod, odvojene | ritam |
| Da/Ne kao **obojene pločice** | običan tekst „Da"/„Ne" | gola tabela |
| Glavna dugmad **oivičena** | puna crvena | previše crvenog |

⚠ **Koja radnja postaje ikonica, a koja ne.** Red šifarnika ima tri radnje: **Izmeni**,
**Deaktiviraj/Aktiviraj** i **trajno obriši**. Trajno brisanje je već ikonica (kanta) i ostaje.
Izmeni postaje olovka, Deaktiviraj postaje prekidač — obe **sa `title` i `aria-label`**, jer ikonica
bez imena je zagonetka za onoga ko ekran vidi prvi put. Ništa se ne skriva iza „…" menija: tri
radnje staju u red, a sakrivena radnja je radnja koju niko ne nađe.

**Osam od trinaest ekrana deli `ResourceListPage`**, pa ih osam sređuje jedan fajl. Preostalih pet
(Korisnici, Revizija, Ovlašćenja, Podešavanja, Bezbednost) su svoji i idu pojedinačno.

⚠ **Crvena dugmad nisu greška admina.** `@mr/ui` mapira `default` na `bg-primary`, a `outline` i
`secondary` na `brandSecondary` — brend-crvena je namerni sistem dugmadi za sve tri aplikacije.
Internal izgleda drugačije jer `<Button>` uglavnom **ne koristi**, nego stilizuje svoje kroz `mri-*`.
Zato se ovde **ne dira `buttonVariants`**: menja se koje varijante admin bira i gde koristi ikonicu
umesto teksta. Promena samog sistema dugmadi je brandbook odluka za sve tri aplikacije i Nikolina je.

## 5. Deo B — kontrolna tabla

Internalova početna je model: traka sa datumom, naslov, red pločica sa obojenim tačkama, dve kartice
sa spiskovima, pa grafikon.

Admin dobija isti raspored, sa sadržajem koji odgovara njegovoj ulozi:

| Blok | Izvor | Novi rad na serveru |
| --- | --- | --- |
| Red pločica (u obradi, ovog meseca, aktivni korisnici, na čekanju) | `stats` + `trends` | ne |
| **„Traži tebe"** — nalozi koji čekaju odobrenje, sa imenom i vezom | `usersListOptions`, već se povlači | ne |
| **„Poslednje promene"** — ko je šta menjao | `auditLogListOptions({})`, endpoint postoji | ne, ali **jedan zahtev više** (vidi ⚠) |
| Grafikon po mesecima | `chart` | ne |
| **„Ko najviše greši"** — 5 radnika sa najviše krivica | **novo, vidi §6** | **da** |

⚠ **Šta se već povlači, a šta je nov zahtev.** Ruta table danas učitava `dashboardSummaryOptions`
**i** `usersListOptions` — znači pločice, grafikon, obe liste reklamacija i „Traži tebe" ne koštaju
ništa novo. „Poslednje promene" traži `auditLogListOptions({})`, koji se danas na toj ruti ne
povlači: **jedan zahtev više po otvaranju table**, sa istim keširanjem kao na ekranu Revizija. To je
jedini novi zahtev u U-7 i vredi ga: bez njega tabla nema ništa o tome šta se u sistemu dešavalo.

„Traži tebe" je ono što tablu čini kapetanskom stolicom umesto zbirom brojeva: ekran ne kaže šta
postoji, nego **šta čeka odluku**. Broj naloga na čekanju danas već stoji na tabli — kao broj, bez
imena i bez veze.

## 6. „Ko najviše greši" — jedina nova stvar na serveru

Podatak postoji i računa se od Grupe D: `StatisticsByFaults.byEmployee`. Ali:

⚠ **Kontrolna tabla NE SME da zove `/api/statistics/summary`.** Taj endpoint radi **11 paralelnih
upita** (trendovi po mesecu i godini, proizvođači, ishodi, vreme obrade, stopa prihvatanja, radnici,
tipovi motora, iznosi, kupci, krivica) da bi vratio celu statistiku. Pozivati ga radi pet imena
znači platiti jedanaest upita na svako otvaranje table — tačno onaj trošak bez razloga zbog kog je
revizija i tražena.

**Umesto toga:** `GET /api/dashboard/summary` dobija još jedno polje, `topFaultEmployees`, sa **najviše
5 redova** iz jednog upita nad `emotive_claim_faults` + `domace_claim_faults`.

⚠ **Dozvola putuje sa podatkom.** `byEmployee` je u statistici `null` za čitaoca bez
`employees.view_analytics` — koliko je puta **imenovan čovek** okrivljen je baš ono što ta dozvola
štiti, i prazan spisak bi bio tvrdnja o pogonu umesto o čitaocu. Novo polje se ponaša **isto**:
`null` bez te dozvole, a kartica se tada ne iscrtava. Ne sme se pretpostaviti da je čitalac admin
samo zato što je ljuska admin-only danas — R-6 je ceo posao oko toga da se to menja.

## 7. Šta se NE dira

- Nijedna migracija, nijedna nova dozvola, nijedan šifarnik.
- Nijedan ekran ne menja **šta radi** — samo kako izgleda.
- `buttonVariants` u `@mr/ui` (vidi §4).
- Raspored bočnog menija i redosled stavki.
- Brend-crvena kao boja: ostaje `#ed1c24`, samo prestaje da bude podrazumevana za svaku radnju.

## 8. Redosled

Nikola je 19.08. izabrao **„samo izgled admina, ostalo posle"**: uzrok DEO+KVAR (Faza 2 sa sastanka
16.08.) ide kao svoja sesija, posle spajanja u `main`.

| Korak | Sadržaj | Server |
| --- | --- | --- |
| U-5 | `ResourceListPage`: kartica filtera, zaglavlje spiska sa brojem, radnje kao ikonice, stranice unutar kartice, Da/Ne kao pločice | ne |
| U-6 | Pet samostalnih ekrana na isti oblik | ne |
| U-7 | Kontrolna tabla: pločice, „Traži tebe", „Poslednje promene", grafikon — sve iz onoga što se već povlači | ne |
| U-8 | `topFaultEmployees` + kartica „Ko najviše greši" | **da** |

U-7 pre U-8 namerno: ako se posle U-7 ispostavi da tabla već odgovara na dovoljno pitanja, U-8 je
jedina stavka koja traži rad na serveru i može da sačeka Fazu 2, gde ionako dobija drugu polovinu
(„koliko puta dihtung nije bio dobar").

## 9. Dokaz pre komita

Pun gejt pod `TZ=UTC`, podeljen kako CLAUDE.md nalaže. Uz to, za posao koji je ceo vizuelan:

- **Svaki izmenjen ekran otvoren u pretraživaču**, u obe teme i oba jezika. Gejt ne vidi izgled —
  19.08. je bio zelen dok su značke bile svetle na crnom, tabla je pisala isto dvaput, a spisak
  ovlašćenja se povlačio dvaput u minuti.
- Za svaku logiku koja nije čisto stilska (na primer izbor ikonice po vrsti radnje) ostaje test, i
  taj test se **vidi crveno** pre nego što se prizna.

## 10. Otvoreno, svesno

- **Sistem dugmadi u `@mr/ui`** (brend-crvena kao podrazumevana) — Nikolina odluka, tiče se sve tri
  aplikacije, i namerno je van ovog posla.
- **Pozadinska tekstura** (mrežica + zupčanik) koju internal ima a admin nema. Nije uvrštena: to je
  ukras, a četiri primedbe koje su nabrojane rešava raspored, ne tekstura. Ako posle U-7 i dalje
  deluje prazno, tada je jeftino dodati.
- **`employee_monthly_output`** — postoji od migracije `0004`, Excel ga čita i deli njime, a niko ga
  nikad ne puni, pa se PROCENAT računa protiv nule. Nije deo ovog posla, ali se ovde zapisuje jer
  „Ko najviše greši" prikazuje **apsolutan broj krivica**, a ne stopu — i to je jedini pošten
  prikaz dok ta kolona ne dobije pisca.
