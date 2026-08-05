# Prijem vozila — pet otvorenih pitanja (dizajn)

**Datum:** 2026-08-05 · **Grana:** `feat/vehicle-intake` · **Osnova:** `c3fa630`
**Status:** odobreno (Nikola, 2026-08-05) — čeka izgradnju

---

## 0. Šta je ovo

Pet stvari koje su tokom V-6-1b ostale **otvorene i zapisane kao „čeka Nikolu"** na dnu
`.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md`. Nisu jedna funkcija — pet nezavisnih
odluka o istom modulu. Ovaj dokument beleži **šta je odlučeno i zašto**, jer je razlog ono što se
zaboravi za dva meseca, ne kod.

Nijedna od pet ne dira šemu baze, ne uvodi migraciju, ne uvodi novu dozvolu i ne traži seed u
produkciji.

**Van dometa:** Zadatak 12 (nastavljanje prijema), V-6-2 (režim izmene), V-7 (štampa).

⚠️ **Jedna od pet DIRA Zadatak 11.** Stavka 2 gradi upozorenje o nepristiglim fotografijama koje
stari V-6 spec (§4.5) i plan traže *unutar* taba Fotografije. Da su obе sagrađene, isto upozorenje
bi stajalo dva puta. Odlučeno: **ovde, na nivou strane** — serviser sleti na Pregled a ne na
Fotografije, i traka se vidi sa sva četiri taba. Stari spec i plan su ispravljeni u istom komitu,
pa Zadatak 11 više ne traži svoju traku.

---

## 1. Gorivo se prikazuje samo na potpisanom nalogu

**Odluka:** na tabu „Pregled" gorivo se prikazuje kada je `signedAt !== null`. Na nedovršenom
prijemu stoji crtica.

**Zašto.** `fuel_level` je **jedina** kolona prijema koja je `NOT NULL` sa podrazumevanom vrednošću
(`packages/db/src/schema/intake-orders.ts:69`, `.notNull().default(4)`). Svaka susedna — kilometraža,
VIN, adresa, napomena o opremi — sme da bude prazna, pa prazno tamo pošteno znači „niko nije uneo".
Gorivo to ne može: kazaljka uvek stoji negde i baza pamti broj bez obzira da li ju je iko pipnuo.

Ekran je to do sada gatao po koraku („prošao korak 2 → veruj broju"), što promašuje u oba smera:
serviser je mogao da prođe korak 2 ne dodirnuvši kazaljku, a nacrt parkiran na koraku 4 stvarno ima
uneto gorivo.

Potpis je jedina tačka u kojoj broj prestaje da bude podrazumevana vrednost i postaje **tvrdnja koju
su serviser i mušterija potvrdili**. Zato je granica tu, a ne na koraku.

**Odbijena alternativa:** kolona da postane `NULL`-abilna. To je migracija + izmena čarobnjaka +
stanje „nije podešeno" na meraču **kojeg prototip nema** (bilo bi pitanje za Design). I nosi novu
neugodnost u drugom smeru: potpisan nalog na kojem niko nije dirao kazaljku pisao bi „nije uneto"
iako ga je mušterija potpisala.

**Posledica koju treba izvesti do kraja:** `conditionRecorded` i `STEP_CONDITION` u
`tab-overview.tsx` postoje samo zbog goriva. Kad gorivo pređe na potpis, oni ostaju bez čitaoca i
**brišu se** — inače je to mrtav kod, koji CLAUDE.md §6 zabranjuje. `damageRecorded`,
`STEP_DAMAGE` i `recordedThroughStep` ostaju (imaju svoje čitaoce).

**Šta ova odluka NE rešava, i to je namerno:** potpisan nalog na kojem serviser nikad nije dirao
kazaljku i dalje piše `4/8`. Potpis čini broj **dogovorenim**, ne i **izmerenim**. Zatvaranje toga
je nullable kolona, koja je gore odbijena — pa je ceo ovaj sloj u kodu zapisan kao svesna granica,
ne kao propust.

**Neobičnost koju treba znati:** na nacrtu parkiranom na koraku 5 ista kartica pokazuje zelenu `0`
za nedostatke i crticu za gorivo. Nije nedoslednost: prazna lista šteta **posle** koraka 3 je
tvrdnja koju je neko izneo, a podrazumevana `4` nije bila nikad. Ekran to ne objašnjava — ako
zasmeta u radu, jeftin lek je da crtica dobije razlog kao što ga ima kartica šteta.

---

## 2. Traka „nisu sve fotografije stigle"

**Odluka:** detalj dobija traku pune širine, amber, koja se pojavljuje samo kad `photosPending > 0`,
u istoj porodici sa postojećim trakama za nedovršen i uklonjen nalog. Vidi se sa svakog taba.

**Zašto.** Podatak već postoji na listi (amber ikonica uz red), ali na detalju ga nije bilo nigde —
a detalj je ekran na koji čarobnjak **spusti servisera odmah po potpisu**, sa strankom pored kola.
To je trenutak u kome „dve fotografije još nisu stigle" nešto znači; sat vremena kasnije je samo
podatak.

**Odbijene alternative:** bedž u zaglavlju (čita se kao oznaka, ne kao nešto što traži radnju);
brojka uz labelu taba (broj je koliko **nedostaje**, pa bi „Fotografije (2)" čitalo kao „dve
fotografije" — laž); ikonica kao u listi (na tabletu nema hovera, pa objašnjenje niko ne vidi).

**Tekst mora ostati brojno-neutralan** („Nedostaje 2"), jer Paraglide u ovom repou ruši build na ICU
pluralima.

---

## 3. Potvrda samo na „Gotovo → Preuzeto"

**Odluka:** dugme za napredovanje statusa otvara potvrdu kada je sledeći status „Preuzeto"
**i kada onaj ko klikće ne može sam da vrati status nazad**. Prva dva napredovanja ostaju jedan tap.

⚠️ **Drugi uslov nije bio u prvobitnoj odluci — dodat je pri proveri, jer je pravilo bilo šire od
svog razloga.** Razlog je „serviser nema puta nazad". Ko drži `intake_orders.change_status` ima
traku sa statusima **odmah ispod ovog zaglavlja** i vraća status u jednom tapu — njemu dijalog ne
štiti ništa, a on je najčešći korisnik ovog ekrana. Tri dijaloga dnevno na čoveku koji ih ne treba
je tačan način da dijalog prestane da se čita. Zato se kapija vezuje za razlog (`change_status`),
ne za status sam.

**Zašto.** Serviser ima `intake_orders.advance` (korak napred), ne i `intake_orders.change_status`.
Posle „Preuzeto" nema sledećeg statusa, pa **dugme nestane** — ostaje bez ijednog puta nazad, a
poruka mu ne kaže ni kome da se javi. Uz to, „Preuzeto" tvrdi fizičku činjenicu: da je mušterija
odvezla auto. Prva dva statusa kancelarija vrati u jednom tapu.

**Odbijena alternativa:** potvrda na svakom napredovanju. Tri dijaloga po nalogu nauče servisera da
potvrđuje ne čitajući — čime dijalog prestane da štiti i onaj treći, jedini koji je i trebalo da
štiti.

**Odbijena alternativa:** „Poništi" u poruci. Serviser nema pravo da vraća status, pa bi to tražilo
ili novu dozvolu ili da `advance` nauči da ide unazad u roku od N sekundi — nova serverska pravila,
nov audit zapis, novi testovi. Nesrazmerno.

---

## 4. Greška učitavanja nudi „Pokušaj ponovo"

**Odluka:** oba ekrana Servisa — detalj i lista — dobijaju dugme koje ponovo pokuša, po uzoru na
emotive detalj (`routes/_shell/reklamacije/emotive/$id.tsx:93-123`). Ne prikazuje se na 404.

**Zašto.** Bez njega prolazan pad mreže košta osvežavanje cele strane, a lista je serviserov početni
ekran na tabletu. Obrazac već postoji u aplikaciji na tri mesta — Servis je jedini koji ga nema.

**Kako, i zašto tako.** Obe greške su danas **funkcije zatvorene u fajlu rute**, pa se ne mogu
testirati bez montiranja cele rute — zamka koju je ovaj modul već platio. Zato izlazi jedna
komponenta koju obe rute pozovu sa svojim tekstom. Dva pozivaoca su na granici pravila „kopija tri
puta pa izvlači"; presudila je **mogućnost testa**, ne broj pozivalaca.

⚠️ **NAJVEĆI NALAZ DANA: dugme koje sam hteo da preslikam ne radi.** Kad *loader* padne, ruter
ostavi svoj match u stanju `error`. `reset`, koji ruter daje `errorComponent`-u, briše **samo**
stanje granice za hvatanje grešaka — React ponovo iscrta, match ponovo baci istu grešku, i ista
kutija se vrati. Nijedan zahtev ne ode. Zato retry ide preko **`router.invalidate()`**, jedinog
poziva koji pali match vraća u `pending` i ponovo pokreće loader. To usput rešava i drugu rupu:
`reset` je `undefined` na serveru, pa bi dugme čije prisustvo zavisi od njega postojalo na klijentu
a ne na serveru — neslaganje pri hidraciji, baš u toku zbog kojeg kutija i postoji.

⚠️ **Isto mrtvo ožičenje ima još sedam mesta** (oba detalja reklamacija, tri liste, dva portalska
ekrana) plus `RouteError` iz `@mr/ui`, koji je podrazumevana greška cele `internal-web`.
**Prijavljeno, namerno nedirano** — to je svoja izmena, ne prikolica na ovoj.

---

## 5. Tuđ nacrt traži `delete`, ne samo `update`

**Odluka:** u `IntakeOrdersService.delete`, nacrt koji **nije tvoj** dodatno traži
`intake_orders.delete`. Svoj nacrt i dalje ide sa `update`.

**Zašto.** Ruta traži `update` **ili** `delete` (`requirePermissions` je `.some(...)`, dakle „bilo
koje od"), servis dodatno traži `delete` samo za **potpisan** nalog, a provera vlasništva je na
brisanje namerno izostavljena — sa zapisanim razlogom: kancelarija mora da može da baci nacrt
servisera koji je otišao iz firme.

Posledica: rola sa `view` + `update` **bez** `delete` može **trajno** (tvrdo, bez `deleted_at`) da
obriše tuđ započet prijem. Nijedna zasejana rola nema taj par — serviser nema `view`, kancelarija
ima `delete` — pa je dohvatljivo samo kroz rolu koju neko ručno sklopi u adminu. Ali „nedohvatljivo
danas" nije pravilo; pravilo je da je server sudija (CLAUDE.md §2).

Popravka **prepisuje nameru koja već stoji napisana u komentaru** — samo je server nije sprovodio.
Kancelarija ima `delete`, pa pravilo o otišlom kolegi preživljava netaknuto.

**Odbijena alternativa:** da svako brisanje nacrta traži `delete`. Serviser ga nema, pa bi izgubio
mogućnost da odbaci **sopstveni** započet prijem — funkciju koja radi i provozana je.

**Uz popravku idu i dva komentara koja od tog trenutka lažu:** onaj na ruti i doc iznad
`assertDraftOwner` („`delete` je namerno nečuvan").

---

## 6. Šta se ne menja

Šema, migracije, dozvole (nijedna nova), čarobnjak, prototip, produkcijski seed. Nijedna od pet ne
zahteva ništa da se pokrene posle deploya.

---

## 7. Izgradnja

Pet komita, svaki jedna stvar. Prvi je serverski (`api`), ostala četiri `internal-web` — razdvojeno
jer su to dva nezavisna gejta. Pun gejt jednom, pre pusha. Nikad dva gejta istovremeno.

i18n ključevi idu **u isti komit** koji ih troši, kako repo već radi (`db22736`, `993edae`) — bez
ključa Paraglide ne generiše `m.*` i komit ne tipizira sam za sebe.

**Šta se NE može dokazati testom:** `internal-web` nema nijedan test na nivou rute, pa nijedna
tvrdnja ne može da pokrije da su traka i kutija greške stvarno montirane u rutama. To je ista rupa
zbog koje je Zadatak 10 umalo isporučio mrtav tab. Komponente se testiraju odvojeno, **montiranje se
proverava u pregledaču i to se piše u poruci komita** — isto kako je Zadatak 10 uradio za
containment i prag kolona.
