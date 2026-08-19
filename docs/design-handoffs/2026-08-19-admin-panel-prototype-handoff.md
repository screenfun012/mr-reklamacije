# Admin panel — Design handoff (uz radni prototip)

**Za:** Claude Code · **App:** `admin-web` · **Datum:** 19.08.2026
**Funkcionalni izvor istine:** `2026-08-19-admin-panel-design-handoff.md` (opis svih ekrana, rečnik, §9 šta NE postoji)
**Vizuelni izvor istine:** `admin-prototip.dc.html` — **klikabilan radni prototip, 1440×900**. Sve boje, razmaci i veličine se čitaju iz njega, ne procenjuju.

> Pravilo prvenstva: funkciju definiše funkcionalni dokument, izgled i ponašanje definiše prototip. Gde se razlikuju — pitaj, ne improvizuj.

---

## 0. Šta prototip pokriva (sve je klikabilno)

- **Okvir:** topbar 60px (☰ · MR ENGINES + ADMIN čip · mono breadcrumb sekcije · EN/SR · tema) + sidebar 236px sa **grupama**: Kontrolna tabla · LJUDI I PRAVA (Korisnici sa amber badge-om broja zahteva, Ovlašćenja, Revizija) · ŠIFARNICI (svih 10, uključujući nova dva: Vrste oštećenja, Način dolaska) · SISTEM (Podešavanja) · korisnički blok dole (inicijali, ime, mejl, Bezbednost, Odjava).
- **Kontrolna tabla** — „kapetanska stolica": 4 pločice (Čeka odobrenje je klikabilna → Korisnici), kartica **Traži tebe** (amber ivica — jedina kartica sa naglaskom), **Ko najviše greši** (horizontalne amber trake), grafikon **Reklamacije po mesecima** (24 meseca, stacked EMOTIVE plava / DOMAĆE ljubičasta), **Poslednje promene** (značke akcija + „Sve →"), **Najnovije reklamacije**, **Najduže otvorene** (crveni „N dana" pill).
- **Korisnici:** sekcija „Zahtevi na čekanju" (amber ivica kartice, ODOBRI zeleno / ODBIJ crveni outline) + „Svi korisnici" sa pretragom; radnje po pravilima (zaštićen/self bez radnji sa objašnjenjem, klijent ima „Pošalji ponovo link"); Odobri otvara izbor ovlašćenja; Odbij ima potvrdu sa rečenicom o nepovratnosti.
- **Ovlašćenja:** tabela sa STANDARDNO (plava) / TVOJE (tirkiz) značkama; Pogledaj/Izmeni/Umnoži/Obriši (mrtvo dugme na klik KAŽE zašto); **dijalog matrice 84 radnje u 16 modula** — 3 kolone (CSS columns), po modulu brojač `n/m` + SVE/NIŠTA, zaključan režim za STANDARDNO sa plavom notom, amber upozorenje kad ovlašćenje neko drži; Umnoži → dijalog sa dva naziva.
- **Revizija:** filter kartica (korisnik/entitet/akcija/od/do — selecti stvarno filtriraju), redovi sa strelicom za razvijanje (IP, uređaj, polja pre→posle kao crveni/zeleni mono čipovi, kontekst), „UČITAJ JOŠ".
- **Šifarnici:** JEDAN obrazac za svih 10 — naslov+podnaslov, „+ Dodaj", segmented SVI/AKTIVNI/NEAKTIVNI + pretraga, kartica „Lista · UKUPNO: N" (realne veličine: Radnici 125, Odeljenja 21…), tabela sa „Koristi se" i Aktivan DA/NE pilulama, IZMENI/DEAKTIVIRAJ/kanta, paginacija u kartici. Šifra zaključana pri izmeni (dashed polje „ZAKLJUČANO"). Trajno brisanje mrtvo dok se koristi — klik na mrtvo dugme ispisuje razlog sa brojem zapisa.
- **Podešavanja aplikacije:** 2 grupe × 2 polja, značka PODRAZUMEVANO, „Vrati na podrazumevano", jedno Sačuvaj (mrtvo dok nema izmena; hint „Šalje se samo izmenjeno: N polja").
- **Bezbednost:** 2FA status pill + dijalog sa QR kodom i 8 kodova za oporavak; isključivanje kroz potvrdu.
- **Prijava:** kartica sa greškom-banerom; dole 6 demo čipova — svaka od 6 propisanih poruka o grešci ima svoje mesto.
- **Ostalo:** skeleti pri promeni ekrana (~480ms, shimmer), toast posle svake radnje, dijalozi potvrde za sve što briše/isključuje, prazna stanja (pretraga bez pogotka), obe teme (`[data-adm="dark"|"light"]`).

## 1. PRAVILO CRVENE (odgovor na primedbu br. 2 — obavezno primeniti)

Brend crvena `#ED1C24` sme da postoji SAMO kao:
1. **Identitet u malim dozama:** ADMIN čip, aktivna stavka menija (tinta `rgba(237,28,36,.11)`), aktivni segment filtera, fokus ring inputa, avatar.
2. **Destruktivno:** dugmad koja briše/odbija su **crveni outline** (transparent + crvena ivica + crven tekst); **puna crvena ispuna postoji samo u dijalogu potvrde** (tinta .16), nigde drugde.

**Crvena NIKAD nije:** primarno dugme (primarno je svetla ispuna `--btn` #f2f2f3 / tamna na svetloj temi), boja statusa „u redu", boja značaka, boja grafikona (EMOTIVE=plava, DOMAĆE=ljubičasta), boja linkova unutar tabela (linkovi-akcije su neutralni, hover u tekst boju).

Semantika ostalih boja: amber = čeka odluku (zahtevi, upozorenja) · zelena = potvrda/aktivno · plava = STANDARDNO/info · **tirkiz `#14b8a6` = TVOJE** (jedina nova nijansa; dodaj u tokene) · ljubičasta = DOMAĆE/izvoz · siva = neaktivno.

## 2. Tokeni

`--adm-*` blok po uzoru na `--mri-*` (vrednosti u prototipu, helmet): bg `#0b0b0d`, surface `#131316`, raised `#1a1a1f`, border `.09/.16` bele, text `#f2f2f3`/`#9c9da3`, inbg `rgba(255,255,255,.045)`, rowhv `.03`, btn `#f2f2f3`/btntx `#141417`, grn/amb/blu/gry/teal/pur — plus svetla tema (vrednosti u `[data-adm="light"]`). Mreža u pozadini 56px. Fontovi Figtree + JetBrains Mono (mono za: šifre, MR brojeve, mejlove, datume, brojeve u tabelama, eyebrow labele, značke). **TODO hoist:** ovo je treći `--*` blok (portal `--mrp-*`, interna `--mri-*`) — vreme je za zajednički paket, uradi kao poseban PR pre restilizacije.

## 3. Komponente (nacrtane jednom, koriste se svuda — §5 funkcionalnog dokumenta)

Kartica-panel (surface + border 1px + radius 13-14px, header 13px/18px padding, naslov 14.5px w800 + meta mono desno) · tabela kao CSS grid sa mono zaglavljem 9px/.14em i hover redom · značka-pill (`rgba(boja,.13)` + tačka 5px + mono 9.5px) · vrsta-značka (kvadratnija, radius 7px) · dugmad: primarno (svetla ispuna + senka), outline, ghost, destruktivni outline, mrtvo (opacity .45 + klik ispisuje razlog) · filter traka · paginacija u kartici · dijalog forme 520px · dijalog potvrde 480px (mono tag u boji težine radnje) · prazno stanje (italic) · skelet (shimmer) · toast (dole-centar, tamna pilula, zelen check).

## 4. Redosled implementacije

1. Tokeni + okvir (topbar, sidebar sa grupama, korisnički blok) — obe teme.
2. Kontrolna tabla (koristi `recent`/`overdue`/`chart` koje server već šalje — ništa novo na API-ju).
3. Generički šifarnik (jedna komponenta + konfiguracija po ekranu) → svih 10 odjednom; **nova dva ekrana** (Vrste oštećenja, Način dolaska) traže i nove API rute — prijavi ako ih nema.
4. Ovlašćenja + matrica (najteži deo — 3 kolone, SVE/NIŠTA po modulu, zaključan režim, upozorenje o prekidu prijave).
5. Korisnici, Revizija (razviv redovi, filteri).
6. Podešavanja, Bezbednost, Prijava (svih 6 poruka o grešci).

Pravila koja se NE preskaču: mrtvo dugme uvek kaže zašto · sve destruktivno kroz dijalog · tri stanja svake liste (prazno/skelet/greška) · tekstovi doslovno iz §7 funkcionalnog dokumenta · bez zvona, bez izmišljenih ekrana (§9) · EN nizovi 35% duži — raspored ih mora podneti.

## 5. Handback

Screenshotovi: kontrolna tabla, korisnici (sa zahtevima), ovlašćenja + otvorena matrica (edit i zaključan režim), revizija sa razvijenim redom, jedan šifarnik, podešavanja, prijava sa greškom — sve u obe teme. Pun CI gate, commit posle odobrenja. Mobilni prikaz (390) radimo posle desktop odobrenja — javi kad stigneš dotle.
