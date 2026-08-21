# Reklamacije po vrsti posla — handoff za Claude Design

**Šta je ovo:** opis **funkcije** — kako čovek u firmi ulazi u reklamacije, unosi ih i prati — da bi
se na osnovu njega nacrtao **izgled**. Ne propisuje raspored, boje ni tipografiju; to je tvoj posao.
Propisuje šta na ekranu MORA da postoji, jer iza svake stavke stoji podatak koji sistem stvarno ima.

**Kako se koristi:** §1–§5 su kontekst. §6 je problem koji rešavamo (i on je jedini razlog ovog
dokumenta). §7 su ekrani koje treba nacrtati. §8 su podaci koji postoje — ne izmišljaj druge. §9 je
zahtev koji je vlasnik izričito postavio i najlakše se previdi. §10 je čega nema. §11 su tehnička
ograničenja koja dizajn mora da podnese.

---

## 1. Proizvod u pet rečenica

MR Engines (Srbija) remontuje motore. Interni sistem vodi **reklamacije** (garancijske) i **prijem
vozila u servis**. Tri odvojene aplikacije nad jednim API-jem: **internal** (radnici i kancelarija
obrađuju reklamacije — ovo je ta aplikacija), **portal** (klijent vidi svoje reklamacije) i **admin**
(korisnici, prava, šifarnici).

**Ko koristi ovaj ekran:** kancelarija i majstori — danas nekoliko ljudi, cilj je najmanje 50.
Nisu kancelarijski tipovi; unose između dva posla, često stojeći, na tuđem računaru.

**Gde:** desktop (laptop 1440×900 je referenca), povremeno tablet u dvorištu. Telefon je redak, ali
ne sme da bude slomljen.

---

## 2. Brief — vlasnikove reči, doslovno

> „Ja sada hoću da unesem novu reklamaciju za mašinsko — kako ja to da uradim? Zbunjujuće je i nema
> smisla kako trenutno stoji."

> „Ja ako hoću da unosim mašinsku reklamaciju i hoću da pratim mašinske reklamacije, neću sigurno da
> idem ovim redosledom kao što je sada, nego ću lepo kao normalan čovek: aha, mašinsko, kliknem, šta
> ima tu, dobro, idemo, popunjavam."

> „Ovo postaje kompleksan sistem."

To je ceo brief. Dizajn treba da napravi da taj put — *vidim vrstu posla → uđem → vidim šta ima →
unesem novu, već u tom kontekstu* — bude očigledan i kratak.

---

## 3. Rečnik — koristi baš ove reči

| Reč | Znači |
| --- | --- |
| **reklamacija** | garancijska žalba na posao koji je firma odradila |
| **EMOTIVE** | reklamacija stranog partnera. Nikad se ne prevodi, nikad se ne piše malim slovima |
| **DOMAĆE** | domaća reklamacija (firma ili privatno lice). Nikad se ne prevodi |
| **kategorija** | vrsta posla na koji se reklamacija odnosi (četiri, vidi §5) |
| **MR broj** | radni nalog firme, npr. `7167/25`. Piše se mono fontom, nikad se ne prevodi |
| **ishod** | Na čekanju / Prihvaćeno / Odbijeno / Arhivirano |
| **kvar** | kome je pripisana krivica (radnik, odeljenje ili spoljna firma) |
| **nalaz** | šta je majstor našao pri pregledu |
| **partner / firma** | kupac; EMOTIVE ima firmu u sistemu, DOMAĆE nosi ime kao tekst |
| **prijem** | prijem vozila u servis — **drugi modul**, ne meša se sa reklamacijama |

Srpski je primarni jezik, engleski postoji ravnopravno (prekidač u traci). Engleski nizovi su do
~35% duži — raspored mora da ih podnese. Ne koristi se množina koja zavisi od broja: piše se
„Ukupno: 12", nikad „12 reklamacija".

---

## 4. Šta postoji danas (i radi)

- **Jedna lista svih reklamacija** — obe vrste zajedno, sa filterima i stranicama.
- **Dva dugmeta za unos** iznad liste: „Nova EMOTIVE reklamacija" i „Nova DOMAĆA reklamacija".
- **EMOTIVE unos je čarobnjak u 3 koraka:** osnovni podaci → kvarovi → pregled pre slanja.
  **DOMAĆE je jedna duža forma.**
- **Detalj reklamacije** sa sekcijama: osnovni podaci, nalaz pregleda, nalazi, kvarovi, prilozi
  (fotografije i dokumenti), izveštaj za klijenta, i radnje (promena ishoda, objava klijentu).
- **Statistika** sa filterima i grafikonima, uključujući presek po kategoriji.
- Levi meni (sidebar) sa stavkama: Početna, Pristiglo, Reklamacije, Mašinska obrada, Servis,
  Statistika.

**Izgled interne aplikacije je već prerađen i vlasniku se sviđa** — tamna tema, kartice sa
zaglavljem, filteri u svojoj oivičenoj kartici, mono font za brojeve. Novi ekrani ne smeju da deluju
kao drugi proizvod. Traži screenshot, ne pogađaj.

---

## 5. Kategorije — i zašto ih ima baš četiri

Svaka reklamacija od skoro nosi **kategoriju**, tj. na kakav se posao odnosi:

| Kategorija | Šta znači |
| --- | --- |
| **Generalni remont motora** | ceo motor je remontovan — danas ubedljivo najveći deo posla |
| **Mašinska obrada** | obrađen je deo: glava, blok, radilica |
| **Novi delovi** | ugrađeni novi delovi |
| **Auto-servis** | servisni posao na vozilu |

Kategorije **nisu zakucane u kodu** — kancelarija ih dodaje, preimenuje i gasi iz admin panela. Peta
kategorija je pitanje vremena. **Dizajn zato ne sme da pretpostavlja da ih je četiri**: mora da
podnese tri, pet ili sedam, i mora da izgleda razumno kad jedna od njih ima 900 reklamacija a druga
dve.

⚠ **„Auto-servis" (kategorija) i „Servis" (modul prijema vozila) su različite stvari sa sličnim
imenom.** Kategorija znači „reklamacija na servisni posao"; modul Servis je prijem vozila u dvorište,
sa nalogom i potpisima. Ovo je poznata zbrka i dizajn treba da je razreši — bar time što će
kategorije uvek biti vidljivo *ispod* pojma reklamacije.

---

## 6. Problem koji rešavamo

Danas su **vrsta** (EMOTIVE/DOMAĆE) i **kategorija** (četiri gore) dve ukrštene osi, i sistem ih
tretira potpuno različito:

- **vrsta** vodi sve: dva dugmeta za unos, dve forme, dva ekrana detalja;
- **kategorija** je polje unutar forme, koje se bira negde na sredini prvog koraka.

Zbog toga čovek koji hoće da unese mašinsku reklamaciju mora prvo da odluči nešto što ga u tom
trenutku ne zanima (EMOTIVE ili DOMAĆE), pa da usred forme nađe padajući meni i izabere „Mašinska
obrada". A čovek koji hoće da *vidi* mašinske reklamacije mora da otvori opštu listu i namesti
filter.

U meniju trenutno stoji i dugme **„Mašinska obrada"**, koje je zapravo samo prečica na tu listu sa
nameštenim filterom. Vlasnikova primedba je tačna: **zašto baš mašinska ima dugme, a ostale tri
nemaju** — i zašto klik na dugme vodi na ekran koji ne izgleda kao „mašinska obrada", nego kao opšta
lista kojoj je neko namestio filter.

**Zadatak dizajna:** napraviti da kategorija bude ravnopravan, vidljiv ulaz u posao — a da vrsta
(EMOTIVE/DOMAĆE) i dalje bude jasna, jer ona određuje ko sme šta da vidi i da li klijent uopšte vidi
reklamaciju. Ni jedno ni drugo ne sme da nestane.

**Šta NIJE rešenje** (već je odbačeno, sa razlogom): klonirati ceo ekran po kategoriji, tj. napraviti
zaseban modul „Mašinska obrada" sa svojom listom, svojom formom i svojim detaljem. To bi značilo
četiri (pa pet, pa sedam) kopija istog ekrana koje se održavaju odvojeno i vremenom se raziđu.

---

## 7. Ekrani koje treba nacrtati

### A. Meni i ulaz u reklamacije

Reklamacije treba da se u meniju vide kao **jedna celina sa svojim delovima**, a ne kao jedna stavka
plus jedna nasumična prečica. Delovi su kategorije, i dolaze iz šifarnika (dakle: promenljiv broj,
promenljiva imena).

Mora da postoji i **pogled na sve reklamacije zajedno** — vlasnik je izričito rekao da to ostaje.

Pitanja koja dizajn treba da odgovori:
- kako izgleda kad kategorija ima 900 stavki, a druga 2;
- da li se uz svaku kategoriju vidi broj (i da li taj broj znači „ukupno" ili „nerešeno" — vidi §10,
  brojevi po kategoriji danas ne postoje na tom mestu);
- kako se to ponaša na uskom ekranu i u suženom (icon-only) meniju;
- šta je označeno kao „gde sam sada" kad sam u jednoj kategoriji.

### B. Lista jedne kategorije

Ista lista kao opšta, ali čovek treba da **zna da je u mašinskoj** bez čitanja filtera. Naslov,
kontekst, ono što je u toj vrsti posla važno.

Mora da ostane: pretraga, filteri (ishod, vrsta EMOTIVE/DOMAĆE, proizvođač, datumi), stranice,
kolone iz §8, i radnje nad redom.

Pitanje za dizajn: da li unutar kategorije filter „kategorija" i dalje postoji (i šta znači ako ga
čovek promeni — izlazi li iz sekcije?).

### C. Unos nove reklamacije — ulazak kroz kategoriju

Ovo je srce zadatka. Kad čovek uđe u „Mašinska obrada" i klikne da unese novu, **kategorija je već
poznata i ne pita se za nju ponovo** — ali mora da bude vidljiva, jer čovek mora da vidi šta unosi.

I dalje treba negde da se odluči **EMOTIVE ili DOMAĆE** (to menja koja polja se traže i da li klijent
vidi reklamaciju). Dizajn treba da predloži gde ta odluka živi kad se ulazi kroz kategoriju: dva
dugmeta, prvi korak čarobnjaka, prekidač u zaglavlju forme — tvoj predlog.

Mora da ostane i **ulaz bez kategorije** (opšte „Nova reklamacija" sa opšte liste), gde se kategorija
bira u formi kao danas.

EMOTIVE unos je danas čarobnjak od tri koraka, DOMAĆE jedna forma. Ako imaš predlog da se to ujednači,
napiši ga — ali ne pretpostavljaj da je odobreno.

### D. Detalj reklamacije

Ostaje kakav jeste po sadržaju (§8), uz dve stvari:
1. **kategorija mora da se vidi odmah** — to je prva stvar koja odgovara na „kakav je ovo posao";
2. mesto za **polja koja postoje samo kod nekih kategorija** — vidi §9, to je zahtev, ne ideja.

### E. Prazna stanja i greške

- kategorija bez ijedne reklamacije (npr. tek dodata peta);
- filter koji ne vraća ništa;
- kategorija koju je kancelarija ugasila, a stare reklamacije je i dalje nose (to se dešava i mora da
  izgleda razumno, ne kao greška).

---

## 8. Podaci koji stvarno postoje — ne izmišljaj druge

**Kolone u listi:** vrsta (EMOTIVE/DOMAĆE), MR broj, broj reklamacije, kategorija, ishod, vidljivost
klijentu (samo EMOTIVE), partner/kupac, motor (tip), zaduženi radnik, datum prijema, datum završetka,
radnje.

**Filteri:** slobodna pretraga, ishod, vrsta, kategorija, proizvođač motora, opseg datuma, broj
redova po stranici.

**Ishod:** Na čekanju · Prihvaćeno · Odbijeno · Arhivirano.

**Vidljivost klijentu (samo EMOTIVE, tri stanja):** Primljeno → U obradi → Ishod. Klijent ne vidi
ishod dok ga kancelarija ne objavi.

**Sekcije detalja:** osnovni podaci · nalaz pregleda (piše se na engleskom, klijent ga čita) ·
nalazi · kvarovi (kome je pripisana krivica: radnik / odeljenje / spoljna firma) · prilozi
(fotografije i dokumenti) · izveštaj za klijenta · radnje (promena ishoda, objava, brisanje).

**Polja osnovnih podataka:** MR broj, broj reklamacije, partner/kupac, kategorija, proizvođač motora,
tip motora, broj motora, izvor (EMOTIVE), zaduženi radnik, datum prijema, datum završetka, godina,
opis problema. DOMAĆE dodatno ima: broj računa, iznos originalne fakture, iznos delova, iznos rada i
ukupno.

---

## 9. Zahtev koji se najlakše previdi: kategorije se s vremenom razilaze

Vlasnikove reči:

> „Kada sam rekao da mašinsko će da se menja, mislio sam unutar dela za mašinsko — možda neka polja
> nećemo da koristimo ili neće da nam trebaju, to ćemo morati da uklonimo. Ne možemo da ostavimo ta
> polja a da budu samo sakrivena, jer koja je poenta? Sad smo ih sakrili, posle nekog vremena
> vratili, onda stare reklamacije nemaju to ažurirano polje, nije popunjeno kod starih — i onda imamo
> problem sa statistikom."

Prevedeno u zahtev za dizajn:

1. Forma mora da ima mesto za **grupu polja koja pripada samo određenoj vrsti posla** (npr. koji je
   deo obrađen kod mašinske: glava / blok / radilica) — odvojeno i prepoznatljivo, da se vidi da to
   nije zajedničko svima.
2. Detalj mora da ume da napravi razliku između **„ovo polje ne postoji za ovu vrstu posla"**,
   **„postoji ali nije popunjeno"** i **„postojalo je kad je reklamacija uneta, a danas više ne
   postoji"**. Treće je ono zbog čega je vlasnik ovo i pomenuo: stara reklamacija ne sme da izgleda
   kao da je neko zaboravio da popuni polje.
3. Isto važi za statistiku: presek koji broji nešto što postoji samo kod jedne kategorije mora
   pošteno da kaže nad čime broji.

**Ovo ne treba da se reši u ovom krugu** — nema još odluke koja polja se razilaze. Treba samo da u
dizajnu postoji mesto gde to prirodno staje, da se sutra ne krpi.

---

## 10. Čega nema — ne crtaj podatak koji ne postoji

- **Broj reklamacija po kategoriji** ne postoji kao gotov podatak uz meni. Ako ga dizajn traži, reci
  — dodaje se, ali neka bude namerna odluka.
- **Finiji tip mašinske obrade (glava / blok / radilica)** ne postoji kao polje. Portal ima pripremu
  za to, ali podatka nema.
- **Prilozi po kategoriji, šabloni po kategoriji, obavezna polja po kategoriji** — ne postoje.
- **Domaće reklamacije nemaju klijentski portal** — nema vidljivosti, nema objave.
- Nema arhive po godinama, nema izvoza po kategoriji (izvoz u Excel postoji, ali sa svojim pravilima).

---

## 11. Tehnička ograničenja koja dizajn mora da podnese

- **Tamna tema je podrazumevana**, svetla postoji; oba moraju da rade.
- **Boje samo iz postojećih tokena** aplikacije; crvena je brend i čuva se za akcije i upozorenja —
  ne sme da postane pola ekrana. Statusne boje su konstantne u obe teme.
- **Fontovi:** Figtree za tekst, JetBrains Mono za brojeve, MR brojeve i identifikatore.
- **Dva jezika**, engleski do ~35% duži. Bez množine koja zavisi od broja.
- **Desktop je referenca (1440×900)**, tablet mora da radi, telefon ne sme da bude slomljen.
- Reference koje već postoje u proizvodu i ne smeju da se razilaze: postojeći izgled interne
  aplikacije (tamna tema, kartice, filteri u oivičenoj kartici) i admin panel.

---

## 12. Šta očekujemo nazad

Klikabilan prototip (jedan HTML fajl, kao i za admin panel) sa:

1. **meni** — kako reklamacije i njihove kategorije stoje u navigaciji, u punom i suženom stanju;
2. **lista jedne kategorije** (uzmi „Mašinska obrada") sa filterima i stranicama;
3. **opšta lista svih reklamacija** — da se vidi razlika;
4. **unos nove reklamacije ulaskom kroz kategoriju**, uključujući mesto gde se bira EMOTIVE/DOMAĆE;
5. **detalj reklamacije**, sa kategorijom vidljivom odmah i mestom iz §9;
6. **prazna stanja** iz §7E.

Ako negde predlažeš da se odstupi od onoga što danas postoji, napiši to kao izričitu belešku uz
ekran — vlasnik odlučuje, ne pretpostavljamo.

---

## 13. Otvorena pitanja — traže vlasnikovu reč pre ili tokom crtanja

1. Da li modul **prijema vozila** u meniju ostaje „Servis" ili se preimenuje (npr. „Prijem vozila"),
   da se ne meša sa kategorijom „Auto-servis"?
2. Da li uz kategoriju u meniju treba **broj** — i da li taj broj znači ukupno ili nerešeno?
3. Da li **sve kategorije** stoje u meniju uvek, ili samo one koje se koriste (npr. kategorija bez
   ijedne reklamacije)?
4. Da li unos kroz kategoriju **zaključava** kategoriju u formi, ili se sme promeniti u hodu?
