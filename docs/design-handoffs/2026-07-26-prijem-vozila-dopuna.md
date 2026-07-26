# Prijem vozila u servis — DOPUNA handoff-a (za Claude Design)

**Datum:** 26.07.2026 · **App:** `internal-web` · **Tip:** dopuna, ne novi modul.

## Šta je ovo

Dopuna postojećeg handoff-a `2026-07-26-prijem-vozila-handoff.md`. Posle njega je vlasnik
(Nikola) prošao kroz sve otvorene odluke i one su sada zaključane — a nekoliko njih traži
elemente i stanja koje prototip još nema.

**Uz ovaj dokument idu i:**

- `2026-07-26-prijem-vozila-handoff.md` — original, i dalje važi u svemu što ovde nije menjano
- `prijem-prototip.dc.html` — vizuelna osnova (varijanta 1a)
- `prijem-ekrani.dc.html` — statični ekrani i varijante

**Šta se traži:** ažuriran klikabilan prototip, da vlasnik može vizuelno da vidi kako modul
izgleda sa svim dogovorenim stvarima.

---

## Šta se NE menja (važno)

- **Sve što je već nacrtano ostaje.** Tok od 5 koraka, lista, detalj sa 4 taba, A4 štampa
  (varijanta 2b) — kompozicija, tipografija, boje, sve stoji. Ovo je dopuna, ne redizajn.
- **Nema novih tokena.** Postojeći `--mri-*` blok pokriva sve. Provereno u kodu: statusne
  boje iz handoff-a već postoje kao tokeni (`Primljeno` = `--color-mri-info` `#2e90fa`
  identično · `U radu` = `--color-mri-warn` `#f5a623` · `Gotovo` = `--color-mri-ok` `#1fa971`
  identično · `Preuzeto` = `--color-mri-archived`).
- **Tablet-first pravila iz sekcije 2 originala važe za svaki novi element** — mete ≥44px
  (standard modula 48–56px), font u poljima 16px+, bez hover-only informacija,
  `touch-action: none` gde se crta, dark + light.
- **Okvir aplikacije:** modul radi unutar postojećeg okvira interne aplikacije (njen topbar +
  sidebar koji se skuplja u traku sa ikonicama), ne unutar tanke trake iz prototipa. To ne
  menja ni jedan ekran modula — samo znači da su ekrani nešto uži na tabletu (sidebar skupljen
  ≈64px). Ako to negde razbija kompoziciju, reci.

---

## Kontekst odluka (zašto ovo dolazi)

Četiri odluke koje objašnjavaju gotovo sve dodatke:

1. **Broj naloga serviser upisuje ručno** — dolazi sa štampanog bloka, ne generiše ga server.
2. **Fotke se šalju u pozadini** dok serviser radi korake 4 i 5. Tablet je na WiFi-u u hali koji
   varira; fotke se kompresuju na tabletu pre slanja. Slanje zato ima svoja stanja i može da
   zapne.
3. **Fotka se veže za konkretno oštećenje** — ne zbog baze, nego zato da serviser stvarno slika
   tu ogrebotinu, a ne šest opštih fotki na kojima se ništa ne vidi.
4. **Zatečeno stanje sme da se ispravi posle potpisa, ali samo kancelarija/admin** — i tada
   dokument mora da prizna da je menjan posle potpisa.

Uloge koje se pojavljuju u zahtevima:

| Uloga | Šta vidi i može |
| --- | --- |
| **Serviser** (tablet, hala) | Samo svoje naloge. Kreira, popunjava, prebacuje na sledeći status. Ne ispravlja posle potpisa, ne uklanja, ne vraća status. |
| **Kancelarija** (računar) | Sve naloge. Ispravlja zatečeno stanje posle potpisa, postavlja bilo koji status, uklanja potpisan nalog. |

---

## A. Korak 1 — Vozilo i vlasnik

### A1. Polje za broj naloga

Broj naloga se **upisuje**, ne generiše. U prototipu on postoji samo kao mono tekst gore-desno u
traci sa koracima.

- Vlasnik je odlučio: **polje ide tačno tamo gde broj sada stoji, i izgled ostaje isti** —
  bez novog polja u karticama i bez nove kartice.
- Obavezno polje. „Dalje" iz koraka 1 je zaključano dok nije popunjeno (uz postojeća četiri:
  registracija, marka i model, vlasnik, telefon). Amber tekst u podnožju se produžava za njega.
- Mono font, kao i sad. Primer vrednosti: `RN-0249/26`.

### A2. Izbor tipa vozila — 4 tipa

Šema oštećenja dobija četiri oblika vozila, pa serviser mora da izabere koji je.

- Tipovi: **Auto · Kombi · Kamionet · Džip**
- Vlasnik je odlučio placement: **u kartici VOZILO, ispod sekcije „Način dolaska"**, isti obrazac
  dugmadi koji tamo već postoji (samo 4 umesto 3 u redu).
- Podrazumevani tip: **Auto**.
- Izabrani tip određuje koji se crtež prikazuje u koraku 3, u detalju i na štampi.

### A3. Nota kad se vozilo prepozna po registraciji

Original (sekcija 5, korak 1) je predviđa ali kaže „ako lookup ne postoji, preskoči". **Lookup
sada postoji** — server traži prethodne naloge sa istom registracijom. Znači notu treba nacrtati.

- Pojavljuje se posle unosa registracije, kad postoji poklapanje.
- Mora da ponudi **akciju** — „popuni podatke" — koja upiše vlasnika, telefon, adresu, marku i
  model, VIN iz zadnjeg naloga za to vozilo. Serviser posle može sve da promeni.
- Treba i stanje kad je ponuda prihvaćena (da se ne nudi ponovo u krug).

### A4. Nedovršen nalog sa istim brojem

Nalog nastaje na serveru **posle koraka 1** i u listi se ne vidi dok nije potpisan. Zato se može
desiti da upisani broj već pripada nekom nalogu. Tri slučaja, tri različita ishoda:

| Broj pripada… | Šta serviser vidi |
| --- | --- |
| **njegovom nedovršenom nalogu** | ponuda da **nastavi** taj prijem od mesta gde je stao (ne greška) |
| **potpisanom nalogu** | upozorenje da je broj zauzet, sa linkom na taj nalog |
| **nedovršenom nalogu kolege** | upozorenje da je broj zauzet nedovršenim nalogom — bez linka (svoje naloge vidi samo on) |

Original već traži i nastavak nacrta iz tableta („Pri povratku ponudi nastavak", sekcija 5) —
ta dva stanja treba da izgledaju kao jedna stvar, ne kao dva različita mehanizma.

---

## B. Korak 3 — Stanje i fotke (najviše novog)

### B1. Tri nove siluete vozila + mape zona

Uz postojeći auto trebaju **kombi (zatvoreni transporter), kamionet (otvoreni sanduk) i
džip/terenac**.

- Isti prostor `viewBox="0 0 340 556"`, ista orijentacija (prednji deo dole), isti stil linije
  kao postojeći crtež — markeri i štampa računaju na taj koordinatni sistem.
- **Uz svaki crtež mora doći i njegova mapa zona.** Zone iz originala (`hauba`, `gepek /
  poklopac`, `krov`, `vetrobran`, `zadnje staklo`, četiri strane, dva branika) vezane su za
  proporcije automobila i na kombiju ne stoje na istim mestima. Kombi npr. nema gepek, kabina
  mu je kratka, bočne strane duge; kamionet ima jasnu podelu kabina/sanduk.
- Zona se upisuje uz oštećenje i pojavljuje se u listi nedostataka i na štampi, pa reči moraju
  da budu one koje bi serviser sam upotrebio.

### B2. Kamera u redu oštećenja

Svaki red u listi „UOČENI NEDOSTACI" dobija način da se **slika baš to oštećenje**.

- Tok: tapne mesto na šemi → pojavi se red `③ Ogrebotina — prednja leva strana` → tapne kameru u
  tom redu → otvori se kamera → snimak se veže za to oštećenje.
- **Fotka vezana za oštećenje nosi njegov broj** (③) u mreži fotografija, da se vidi šta je čije.
- **Više fotki po jednom oštećenju je dozvoljeno**, treba i stanje reda koji ih ima više.
- Opšte fotke celog vozila ostaju kako su i sad — dugmad `◉ OTVORI KAMERU` i `IZ GALERIJE` se ne
  menjaju.
- Ako se oštećenje obriše, **njegove fotke ostaju** (brisanje markera ne sme da uništi dokaz) —
  samo izgube brojčić.

### B3. Stanja slanja fotografije

Original traži „progres po fotki". Pošto se šalje preko WiFi-a koji varira, treba nacrtati i
ono što može da se pokvari:

- **u toku** — napredak po fotki
- **poslato** — mirno stanje
- **čeka mrežu** — nema veze, poslaće se samo kad se vrati
- **nije uspelo** + način da se pokuša ponovo

Mete za dodir i dalje ≥44px — thumbnail je 4:3 u mreži od 4 kolone, pa stanje mora da se čita i
na toj veličini.

### B4. Podsetnik za oštećenja bez fotke

Amber tekst u podnožju, tipa „2 od 3 oštećenja bez fotke". **Ne blokira „Dalje"** — namerno:
ako blokira, serviser u gužvi nauči da preskoči obeležavanje oštećenja da ne bi zapeo, pa dobiješ
manje evidentiranih oštećenja, ne više.

Isti mehanizam koji podnožje već koristi u koracima 1 i 5, pa verovatno ništa novo ne treba
crtati — samo potvrdi da se poruke ne sudaraju kad ih ima više.

---

## C. Koraci 4 i 5 — slanje u pozadini

Fotke se šalju **dok serviser radi korake 4 i 5** (usluge/materijal, pa potpisi). To je 1–2
minuta rada koji ionako obavlja, i u tom vremenu se slanje krije.

- Treba **nenapadan pokazatelj** na koracima 4 i 5 da fotke još idu u pozadini (npr. koliko ih je
  ostalo) — dovoljno vidljiv da se zna, dovoljno tih da ne odvlači od potpisa.
- Dugme **`✓ ZAVRŠI PRIJEM` treba stanje „čeka se poslednja fotka"** — kad su oba potpisa tu ali
  slanje nije završeno. Postojeće zaključano stanje (`opacity .45`) je za „nema oba potpisa"; ovo
  je drugi razlog i treba drugu poruku u podnožju.
- I stanje kad slanje **ne može da se završi** (nema mreže): serviser mora da razume da nalog
  može da se sačuva i da će fotke otići kad se mreža vrati — a ne da stoji i čeka.

---

## D. Detalj naloga

### D1. Ispravka zatečenog stanja posle potpisa

Sada je šema u detalju samo za gledanje. Kancelarija/admin moraju da mogu da isprave **zatečeno
stanje**: šemu oštećenja, ček-listu, nivo goriva i fotke.

- **Serviser ovo ne vidi.**
- Predlog za razmatranje (ne obavezujući): ista komponenta iz koraka 3 u režimu izmene, da se ne
  crta drugi mehanizam za istu stvar — ali odluči kako je najbolje.
- Usluge, materijal i status se menjaju u svakom slučaju (original to već kaže za usluge i
  materijal, sekcija 5, korak 4).

### D2. Kartica POTPISI kad je nalog menjan posle potpisa

Kartica sada nosi zelenu notu „Nalog je potpisan i zaključan. Izmene se beleže u istoriji."
Kad je nalog **stvarno menjan posle potpisa**, ta nota mora da to kaže — jer papir koji mušterija
drži više nije identičan zapisu.

Ne novi element, nego drugo stanje postojećeg. Tab Istorija već nosi detalje (šta, kad, ko).

### D3. Ispravka statusa na bilo koji

Postojeće dugme „Prebaci u „U radu"" ostaje i to je jedino što serviser vidi — jednosmerno.
Kancelarija/admin moraju dodatno da mogu da **postave bilo koji status** kad se pogreši (prstom
na tabletu se lako promašeno tapne).

Svaka takva ispravka ide u Istoriju sa imenom i vremenom, pa se ne može „tiho" prepraviti.

### D4. Uklanjanje potpisanog naloga

Kancelarija/admin moraju da mogu da uklone potpisan nalog (duplikat, nalog na pogrešan auto).
Nalog nestaje iz liste ali ostaje u bazi sa tragom ko ga je uklonio — to je „meko" uklanjanje,
pa i tekst treba da bude iskren o tome (ne „obriši trajno").

Nedovršen nalog se odbacuje postojećim dugmetom `ODUSTANI` u čarobnjaku — tu ništa ne treba.

---

## E. Štampa (A4, varijanta 2b)

### E1. Oznaka da je nalog menjan posle potpisa

Kad je zatečeno stanje ispravljano posle potpisa, **odštampani nalog mora to da pokaže** — inače
dobijaš dokument koji tvrdi da je mušterija potvrdila nešto što nije potvrdila.

- Mora da stane na **istu jednu stranu** (794×1123, sve u jednoj strani je tvrdo pravilo iz
  originala) — zato ti prepuštam gde i kako, ti si tu stranu složio.
- Sadržaj oznake: datum i vreme izmene + ime osobe koja je menjala.
- Nalog koji NIJE menjan ne sme da dobije nikakav dodatak — čist dokument ostaje čist.

### E2. Crtež po tipu vozila

Šema na štampi uzima crtež izabranog tipa (auto/kombi/kamionet/džip), sa istim numerisanim
markerima. Numeracija mora da bude identična na šemi, u listi nedostataka i na štampi — original
to već zahteva, samo sada važi za četiri oblika.

---

## Šta ostaje nerešeno (ne za ovaj krug)

- **Dokument „Obaveze kupaca"** — original (sekcija 7) traži da štampa deli zaglavlje, podnožje i
  margine sa ostalim štampanim dokumentima firme. Vlasnik ga još nije dostavio. Štampa se
  finalizuje kad on stigne; do tada ostaje kako je nacrtano.
- **Obaveštenja, statistika prijema i Excel izvoz** su odobreni ali dolaze **posle** jezgra
  modula, svaki kao svoja faza sa svojim pitanjima. **Ne crtaj ih sada.**
- **Kamioni i autobusi** su svesno izvan opsega — njihove zone se ne poklapaju ni sa jednim od
  četiri oblika i to bi bila svoja odluka.

---

## Handback

Klikabilan prototip sa svim gornjim stanjima, dark i light. Screenshotovi:

1. Korak 1 — sa poljem za broj naloga, izborom tipa vozila i notom „vozilo prepoznato"
2. Korak 1 — stanje „nastavi nedovršen nalog"
3. Korak 3 — sve četiri siluete (barem kombi i kamionet sa 2–3 markera)
4. Korak 3 — kamera u redu oštećenja, fotka sa brojčićem, i stanja slanja (u toku / čeka mrežu / nije uspelo)
5. Korak 5 — „čeka se poslednja fotka"
6. Detalj — ispravka zatečenog stanja (kancelarija) i ispravka statusa
7. Detalj — kartica POTPISI u stanju „menjano posle potpisa"
8. Štampa — sa oznakom o izmeni, i sa crtežom kombija

**Ako se nešto od ovoga ne miri sa kompozicijom koju si napravio — reci, ne lomi dizajn da bi
stalo.** Bolje da vlasnik odluči šta ustupa.
