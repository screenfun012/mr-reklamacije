# Admin panel — šta sve radi (handoff za Claude Design)

**Šta je ovo:** opis **funkcije** admin panela, ekran po ekran, da bi se na osnovu njega nacrtao
**izgled**. Ovaj dokument ne propisuje raspored, boje ni tipografiju — to je tvoj posao. Propisuje
šta na ekranu MORA da postoji, jer to su podaci i radnje koje sistem stvarno ima.

**Kako se koristi:** sve u §5–§7 postoji i radi danas. §8 su dva ekrana koja tek treba da postoje.
§9 je spisak onoga čega NEMA — ne izmišljaj ga, jer ne postoji podatak iza njega.

---

## 1. Proizvod u pet rečenica

MR Engines (Srbija) remontuje motore. Interni sistem vodi **reklamacije** (garancijske) i **prijem
vozila u servis**. Sistem su tri odvojene aplikacije nad jednim API-jem: **internal** (radnici obrađuju
reklamacije), **portal** (klijent vidi svoje reklamacije) i **admin** — ovaj, **kontrolna ravan**:
korisnici, prava, šifarnici, istorija izmena, podešavanja.

**Ko ga koristi:** danas praktično jedan čovek — vlasnik/super-admin. Sutra još 1–2 osobe iz
kancelarije. To nije alat za masu; to je komandna soba jednog čoveka koji sve pamti u glavi i hoće da
sistem pamti umesto njega.

**Gde:** desktop (laptop 1440×900 je referenca), povremeno tablet. Telefon je redak ali mora da radi.

---

## 2. Brief — šta u sadašnjem izgledu ne valja

Vlasnikove reči, doslovno četiri primedbe:

1. **svaki ekran je gola tabela** — otvoriš ekran, tu je tabela i ništa drugo,
2. **previše crvenog** — brend je crven, pa je pola dugmadi crveno i crvena više ne znači „pazi",
3. **ekrani ne odgovaraju ni na šta** — prikazuju šta postoji, a ne kažu šta traži odluku,
4. **prazan prostor i ritam** — sve je razbacano, ničemu se ne vidi početak i kraj.

Peta, koja stoji iznad svih: **„nije frendli"**. Panel deluje kao alat za administratora baze, a
koristi ga vlasnik firme.

**Referenca koja postoji:** aplikacija `internal` je već prerađena i njemu se sviđa — tamna tema,
kartice sa zaglavljem, ikonice u redovima, filteri u svojoj oivičenoj kartici. Admin ne mora da je
kopira, ali ne sme da deluje kao drugi proizvod. Ako želiš da je vidiš, traži screenshot — ne
pogađaj.

---

## 3. Rečnik — koristi baš ove reči

Reči su zaključane posle demoa na kome je vlasnika zbunila reč „rola" na dva nivoa. Na ekranu se
piše:

| Reč | Znači |
| --- | --- |
| **ovlašćenje** | paket prava koji se daje čoveku (npr. „Prijem — rad u dvorištu") |
| **radnja** | jedna stvar koju sme (npr. „može da potpiše nalog") — 84 ih ima |
| **STANDARDNO** | ovlašćenje koje održava sistem, ne menja se ručno |
| **TVOJE** | ovlašćenje koje je vlasnik sam sastavio |
| **odeljenje** | gde čovek radi u firmi — NIKAD ne daje prava |
| **firma** | kupac/partner (EMOTIVE partner iz inostranstva ili domaći) |
| **EMOTIVE / DOMAĆE** | dve vrste reklamacija; nikad se ne prevode |
| **prijem** | prijem vozila u servis (radni nalog, potpisi, primopredaja) |

Jezici: **srpski je primarni**, engleski postoji ravnopravno (prekidač EN/SR u traci). Engleski nizovi
su do ~35% duži — raspored mora da ih podnese. Ne koristimo množinu koja zavisi od broja: piše se
„Ukupno: 12", nikad „12 naloga".

---

## 4. Okvir — isti na svakom ekranu

**Gornja traka (danas 60px):** dugme za meni (☰), logo MR Engines, oznaka aplikacije („ADMIN"), **ime
sekcije na kojoj si**, a desno prekidač jezika (SR/EN) i prekidač teme.

**Bočni meni (danas 240px, skupljeno 72px, na telefonu fioka):** 13 stavki, svaka sa ikonicom:

Kontrolna tabla · Korisnici · Ovlašćenja · Revizija · Proizvođači motora · Tipovi motora · Firme ·
Odeljenja · Radnici · Eksterni izvođači · Izvori reklamacija · Ček-lista prijema · Podešavanja
aplikacije

⚠ Poslednjih devet su šifarnici i danas stoje u istom nizu kao Korisnici i Ovlašćenja — spisak od 13
ravnih stavki bez grupa. Grupisanje je tvoja odluka; ako grupišeš, drži se dve ose: **ljudi i prava**
naspram **šifarnici**.

**Dno menija:** krug sa inicijalima, ime i mejl prijavljenog, veza **Bezbednost** i **Odjava**.

**Teme:** tamna je podrazumevana, svetla postoji. **Crtaju se obe.**

**Bez zvona:** admin nema obaveštenja (ima ih internal). Ne dodaji ga.

---

## 5. Elementi koji se ponavljaju — nacrtaj ih jednom

Ovih deset se pojavljuje na skoro svakom ekranu. Ako oni imaju ritam, ceo panel ga ima:

1. **Kartica-panel sa zaglavljem** — naslov levo, meta desno (npr. „Lista · Ukupno: 21").
2. **Tabela** — zaglavlje, redovi sa hover stanjem, brojevi poravnati (tabularne cifre).
3. **Radnje u redu** — Izmeni, Deaktiviraj/Aktiviraj, trajno obriši. Ako su ikonice, moraju imati ime
   (tooltip); ništa se ne krije iza „…" menija.
4. **Značke** — statusa naloga (Na čekanju / Odobren / Odbijen / Neaktivan), uloge, vrste ovlašćenja
   (STANDARDNO / TVOJE), akcije u reviziji (Kreiranje / Izmena / Brisanje / Prijava / …),
   aktivan-neaktivan (Da/Ne kao pločica, ne kao goli tekst).
5. **Filter traka** — pretraga + jedan do tri padajuća izbora + raspon datuma.
6. **Paginacija** — „Prikazano 1–20 od 125" + izbor veličine strane; stoji **unutar** kartice spiska.
7. **Dijalog forme** — 2–6 polja, Odustani / Sačuvaj.
8. **Dijalog potvrde** — za sve što briše ili isključuje; naslov, rečenica o posledici, crveno dugme.
9. **Prazno stanje** — svaka lista ima rečenicu kad je prazna (postoje već napisane, u §7).
10. **Skeleti pri učitavanju** (ne vrteške) i **poruke (toast)** posle svake radnje.

**Pravilo koje važi svuda:** mrtvo dugme mora da kaže **zašto** je mrtvo, tu, pored sebe. Npr.
„Ne može da se obriše dok ga neko drži. Broj korisnika: 3".

**O crvenoj:** brend crvena je i boja firme i boja opasnosti — otud primedba br. 2. Treba nam pravilo:
gde je crvena „mi", a gde je „pazi, briše se". Predloži ga u dizajnu.

---

## 6. Ekrani — 13 postojećih

Za svaki ekran: **pitanje** na koje odgovara, **šta prikazuje**, **šta se na njemu radi**.

### 6.1 Kontrolna tabla (`/`) — „Šta traži moju odluku?"

Danas: pozdrav („Dobrodošao, Nikola!"), četiri pločice, dve kartice, jedna lista. Sadržaj:

**Četiri pločice:** Otvorene reklamacije („Reklamacije u obradi") · Ovaj mesec („Nove reklamacije",
sa strelicom gore/dole i razlikom u odnosu na prošli mesec) · Aktivni korisnici („Odobreni nalozi") ·
Čeka odobrenje („Klikni za pregled korisnika" — vodi na Korisnike).

**Kartica „Traži tebe"** — nalozi koji čekaju odobrenje: ime, mejl, veza ka ekranu Korisnici. Prazno:
„Nema naloga na čekanju."

**Kartica „Poslednje promene"** — poslednjih nekoliko izmena u sistemu: značka akcije, entitet, ko je
uradio, kada; veza „Sve →" ka Reviziji. Prazno: „Još nema zabeleženih promena."

**Kartica „Ko najviše greši"** — do 5 radnika sa najviše upisanih krivica na reklamacijama, sa brojem.
Podnaslov: „Broj upisanih krivica".

**⚠ Podaci koje server VEĆ šalje na ovaj ekran, a niko ih ne crta** (slobodno ih koristi, ne koštaju
ništa dodatno):

- `recent` — najnovije reklamacije (MR broj, firma, koliko dana su otvorene),
- `overdue` — najduže otvorene (30+ dana),
- `chart` — broj reklamacija po mesecima, razdvojeno EMOTIVE / DOMAĆE / ukupno (24 meseca).

Ovo je ekran gde primedba br. 3 najviše boli: danas je zbir brojeva, a treba da bude kapetanska
stolica.

### 6.2 Korisnici (`/users`) — „Ko sme da uđe i ko čeka?"

Dve sekcije jedna ispod druge:

**„Zahtevi na čekanju"** — ljudi koji su se registrovali i čekaju odluku.
**„Svi korisnici"** — ostali, sa pretragom po imenu i mejlu (bez paginacije danas; spisak raste).

Kolone: **Ime · Email · Status · Uloge · Registrovan · Akcije**.
Status je značka (Na čekanju / Odobren / Odbijen) plus posebna oznaka „Neaktivan" kad je nalog ugašen.
Uloge su značke, po jedna za svako ovlašćenje koje čovek drži (može ih biti i pet).

**Radnje na čekanju:** `Odobri` (otvara dijalog) · `Odbij` (potvrda; nepovratno je — isti mejl se više
ne može registrovati).

**Radnje na odobrenom nalogu:** `Reset lozinke` · `Izmeni uloge` · `Deaktiviraj` / `Ponovo aktiviraj`.
Klijentima (spoljni korisnici portala) umesto `Izmeni uloge` stoji `Pošalji ponovo link` (aktivacioni
mejl).

**Pravila koja se vide na ekranu:** sebi ne menjaš ništa · zaštićeni super-admin nema nijednu radnju ·
klijentu se uloge ne menjaju odavde (vezan je za firmu, to se radi kroz odobravanje).

### 6.3 Ovlašćenja (`/settings/roles`) — „Šta ovaj paket prava sadrži i ko ga drži?"

Podnaslov ekrana (postojeći tekst, objašnjava ceo model):
_„Ovlašćenje nosi više radnji. Čovek drži više ovlašćenja i prava mu se sabiraju — zato su mali i
nezavisni, umesto jednog velikog za svaku sitnu razliku."_

Tabela, oko 21–26 redova: **Naziv · Vrsta (STANDARDNO/TVOJE) · Radnji (broj) · Drži (broj korisnika) ·
radnje**.
Radnje u redu: `Izmeni` (samo TVOJE) ili `Pogledaj` (STANDARDNO, otvara isti dijalog zaključan) ·
`Umnoži` · `Obriši` (samo TVOJE, mrtvo dok ga neko drži, sa rečenicom zašto).

**Dijalog „Izmena ovlašćenja" — najteži ekran u panelu.** Sadrži:

- naziv na srpskom, naziv na engleskom, opis,
- **matricu od 84 radnje grupisanih u 16 modula**: EMOTIVE reklamacije, DOMAĆE reklamacije, Prilozi,
  Izveštaji o reklamaciji, Prijave klijenata, Obaveštenja, Prijem vozila, Kupci, Radnici, Učinak
  radnika, Statistika, Izvoz, Korisnici, Ovlašćenja, Šifarnici i podešavanja, Istorija,
- po modulu prečice **Sve / Ništa**,
- **mrtve kućice**: radnju koju ni sam ne držiš ne možeš dati — kućica je zaključana i objašnjava se
  („Ovu radnju ni sam nemaš, pa ne možeš da je daš."),
- **upozorenje kad ovlašćenje neko drži**: „Broj korisnika koji drže ovo ovlašćenje: 3. Posle čuvanja
  biće im prekinuta prijava i moraju ponovo da se prijave."

⚠ Izazov: 84 kućice moraju da stanu tako da se ceo paket **pročita**, a ne da se skroluje 84 puta.
Ovo je mesto gde dizajn stvarno menja upotrebljivost.

**Dijalog „Umnoži ovlašćenje"** — samo dva naziva (sr/en); kopija nosi sve radnje originala.
**Dijalog brisanja** — potvrda.

### 6.4 Revizija (`/audit`) — „Ko je šta menjao i kada?"

Podnaslov: „Ko je šta menjao i kada — svaka izmena u sistemu."

**Filter kartica:** korisnik (padajući, pretraživ) · entitet (Korisnik, EMOTIVE reklamacija, DOMACE
reklamacija, Prilog, Firma, Tip motora, …) · akcija (Kreiranje, Izmena, Brisanje, Vraćanje, Prijava,
Odjava, Promena dozvola, Izvoz, Uvoz) · od datuma · do datuma.

**Tabela:** strelica za razvijanje · **Vreme · Korisnik · Akcija** (značka u boji) **· Entitet ·
Izmena** (kratak opis).
**Razvijen red** pokazuje: IP adresu, uređaj/pregledač, spisak izmenjenih polja (pre → posle) i
kontekst.

Dugme **„Učitaj još"** na dnu (beskonačan spisak, bez ukupnog broja — namerno: broj koji raste dok
skroluješ je gori od nikakvog).

### 6.5–6.12 Osam šifarnika — jedan te isti obrazac

Osam ekrana deli isti okvir: **naslov + podnaslov · dugme „+ Dodaj…" gore desno · filter traka
(pretraga + status: aktivni/neaktivni/svi) · kartica spiska sa zaglavljem („Lista · Ukupno: N") ·
tabela · paginacija unutar kartice**.

Svaki red ima kolonu **„Koristi se"** (na koliko reklamacija/naloga stoji) i kolonu **Aktivan (Da/Ne)**.
Radnje u redu: **Izmeni · Deaktiviraj/Aktiviraj · trajno obriši** (trajno brisanje je dozvoljeno samo
dok se stavka nigde ne koristi; inače je mrtvo, sa objašnjenjem).

Razlika je samo u kolonama i poljima obrasca:

| Ekran | Kolone | Polja obrasca |
| --- | --- | --- |
| **Proizvođači motora** | Šifra · Naziv · Redosled · Koristi se · Aktivan | šifra (samo pri kreiranju) · naziv · redosled |
| **Tipovi motora** | Šifra · Proizvođač · Zapremina (ccm) · Koristi se · Aktivan | šifra · proizvođač (izbor) · zapremina · napomena. **Ima i dodatni filter po proizvođaču.** |
| **Firme** | Naziv · Država · Grad · Koristi se · Aktivan | naziv · država · grad |
| **Odeljenja** | Šifra · Naziv (sr) · Naziv (en) · Redosled · Koristi se · **Daje zaduženog radnika (Da/Ne)** · Aktivan | šifra · naziv sr · naziv en · redosled · daje zaduženog radnika |
| **Radnici** | Ime i prezime · Odeljenje · Koristi se · Aktivan | ime i prezime · odeljenje (izbor) |
| **Eksterni izvođači** | Naziv · Vrsta (dobavljač / kooperant / proizvođač / ostalo) · Koristi se · Aktivan | naziv · vrsta |
| **Izvori reklamacija** | Šifra · Naziv · Podrazumevana firma · Prefiks broja · Redosled · Koristi se · Aktivan | šifra · naziv · prefiks · podrazumevana firma · redosled |
| **Ček-lista prijema** | Šifra · Naziv (sr) · Naziv (en) · Redosled · Aktivan | šifra · naziv sr · naziv en · redosled |

⚠ Šifra se unosi samo pri kreiranju; kasnije je zaključana i vidi se kao tekst, ne kao polje.

### 6.13 Podešavanja aplikacije (`/settings/app`) — „Šta sistem radi sam od sebe?"

Četiri podešavanja u dve grupe:

**Obaveštenja:** „Mejl klijentu kad se promeni ishod" (Da/Ne) · mejl adresa na koju stižu nove prijave
klijenata.
**Kontakt podrške:** telefon i mejl podrške — isti podaci idu u podnožje svakog mejla i na karticu
podrške na portalu.

Svako polje ima: naziv, rečenicu objašnjenja, vrednost, značku **„Podrazumevano"** dok nije menjano, i
vezu **„Vrati na podrazumevano"**. Jedno dugme `Sačuvaj` na dnu (šalje samo izmenjeno).

### 6.14 Bezbednost (`/settings/security`) — „Moj nalog"

Jedina stvar na ekranu: **dvofaktorska prijava** za sopstveni nalog — status (uključena/isključena),
dugme za uključivanje (dijalog sa QR kodom i kodovima za oporavak) ili isključivanje (dijalog sa
potvrdom lozinke). Do njega se stiže iz korisničkog bloka u dnu menija, nije u glavnom meniju.

### 6.15 Prijava (`/login`) — jedini ekran van okvira

Mejl + lozinka + dugme. Ako je uključena dvofaktorska, drugi korak traži šestocifreni kod.
Poruke o grešci koje moraju da imaju mesto: pogrešni podaci · previše pokušaja · nalog privremeno
zaključan · nalog čeka odobrenje · nalog odbijen · **nalog nema pravo na admin panel** (radnik koji
pokuša da uđe ovde).

---

## 7. Postojeći tekstovi (koristi ih doslovno)

Ovo su stvarne rečenice sa ekrana — mockup sa izmišljenim tekstom nas kasnije košta prevoda:

- Naslovi menija: Kontrolna tabla · Korisnici · Ovlašćenja · Revizija · Proizvođači motora · Tipovi
  motora · Firme · Odeljenja · Radnici · Eksterni izvođači · Izvori reklamacija · Ček-lista prijema ·
  Podešavanja aplikacije · Bezbednost
- Kontrolna tabla: „Dobrodošao, {ime}!" · „Otvorene reklamacije" · „Ovaj mesec" · „Aktivni korisnici" ·
  „Čeka odobrenje" · „Traži tebe" · „Poslednje promene" · „Ko najviše greši" · „u odnosu na prošli mesec"
- Korisnici: „Zahtevi na čekanju" · „Svi korisnici" · Odobri · Odbij · Reset lozinke · Izmeni uloge ·
  Deaktiviraj · Ponovo aktiviraj · Pošalji ponovo link · statusi: Na čekanju / Odobren / Odbijen / Neaktivan
- Ovlašćenja: Naziv · Vrsta · Radnji · Drži · STANDARDNO · TVOJE · Izmeni · Pogledaj · Umnoži · Obriši ·
  „Standardno ovlašćenje se ne menja — održava ga sistem. Umnoži ga pa menjaj kopiju."
- Revizija: „Revizioni dnevnik" · Vreme · Korisnik · Akcija · Entitet · Izmena · „Učitaj još"
- Šifarnici: „Lista" · „Ukupno: {broj}" · „Koristi se" · „Aktivan" · Da / Ne
- Prazna stanja: „Nema naloga na čekanju." · „Još nema zabeleženih promena." · „Nema zapisa u reviziji." ·
  „Nema nijednog ovlašćenja."

---

## 8. Dva ekrana koja tek treba da postoje

Prijem vozila ima tri šifarnika, a samo jedan (Ček-lista) ima ekran. Nedostaju:

- **Vrste oštećenja** — spisak oznaka koje serviser bira na crtežu vozila pri prijemu,
- **Način dolaska** — kako je vozilo stiglo (sopstveni pogon, šlep, …).

Oba su isti obrazac kao ostali šifarnici: šifra · naziv (sr) · naziv (en) · redosled · aktivan. Ako
tvoj dizajn šifarnika radi za osam, radi i za deset — nacrtaj ih da vidimo da stoje u meniju.

---

## 9. Šta NE crtati (ne postoji podatak iza toga)

- brisanje korisnika (nalozi se samo deaktiviraju), profil korisnika, avatar/fotografija
- zvono i obaveštenja (admin ih nema)
- „uloga se prijavi kao korisnik" (impersonate), više firmi/tenanta, prebacivanje naloga
- izvoz revizije u fajl (dozvola postoji, funkcija nije napravljena)
- bilo kakvi grafikoni osim „reklamacije po mesecima" (jedini vremenski niz koji server šalje)
- iznosi, cene i finansijski pokazatelji na kontrolnoj tabli (statistika je zaseban ekran u drugoj
  aplikaciji, i namerno traži posebno pravo)
- podešavanja kojih nema: SMTP, izgled, teme po korisniku, jezik po korisniku (jezik je prekidač u
  traci)

---

## 10. Tehnički okvir (da se dizajn može sagraditi bez prepravke)

- **Tailwind v4 + shadcn/ui**, ikonice isključivo **lucide**, grafikoni **recharts**, poruke **sonner**.
- Boje idu kroz tokene: brend crvena `#ED1C24`, plus greška (crvena), upozorenje (žuta), uspeh
  (zelena), info (plava), akcenat (tirkiz `#0E9384`) i sivi niz. Ako ti treba nijansa koje nema, reci
  je — dodaje se u sistem, ne piše se u ekranu.
- Font **Figtree** (naslovi i tekst) + **JetBrains Mono** (šifre, MR brojevi, mejlovi u sitnom).
- Tamna tema podrazumevana, svetla obavezna.
- Sve što briše ili isključuje ide kroz dijalog potvrde. Nikad `confirm()` iz pregledača.
- Liste imaju tri stanja: prazno, učitavanje (skelet), greška.

**Realne veličine podataka — mockup neka ih poštuje:**
21 odeljenje · **125 radnika** · ~30 firmi · ~26 ovlašćenja · **84 radnje u 16 modula** · ~134
reklamacije · korisnika 10–40 · revizija: hiljade redova.

---

## 11. Šta očekujemo nazad

Po ekranu jedna tabla (artboard), desktop 1440. Prioritet, ako se pravi u fazama:

1. **okvir** (traka + meni + korisnički blok), tamna i svetla
2. **kontrolna tabla** — ekran koji rešava primedbu „ne odgovara ni na šta"
3. **jedan šifarnik** — jer ih osam deli isti obrazac (rešava „gola tabela" osam puta odjednom)
4. **Ovlašćenja** + dijalog matrice sa 84 radnje — najteži i najvredniji
5. **Korisnici**, **Revizija**
6. **Podešavanja aplikacije**, **Bezbednost**, **Prijava**
7. list komponenti (§5): značke, dugmad, polja, paginacija, prazna stanja

Uz to: mobilni prikaz (390) za Kontrolnu tablu, Korisnike i jedan šifarnik, i po jedno stanje „prazno"
i „učitavanje".

Vrednosti (razmaci, veličine, boje) moraju biti pravi u samom fajlu — integracija ih čita iz
prototipa, ne procenjuje na oko.
