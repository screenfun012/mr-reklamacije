# Prijem vozila — režim izmene (V-6-2, dizajn)

**Datum:** 2026-08-09 · **Grana:** `feat/vehicle-intake` · **Osnova:** `9e98878`
**Status:** predlog — čeka Nikolinu potvrdu pre plana

---

## 0. Šta je ovo

Poslednja neizgrađena stvar u detalju naloga. Server je **gotov od V-6-1** (zna ko sme šta da
menja posle potpisa i sam žigoše nalog), čitanje je gotovo od Zadatka 11, ali **ekrana nema** — pa
danas nijedna ispravka zatečenog stanja nije moguća ni kancelariji. Papirno uputstvo koje radnici
drže obećava suprotno: *„Zatečeno stanje posle potpisa menja samo kancelarija."*

Nema migracije, nema nove dozvole, nema seed-a u produkciji.

**Van dometa:** štampa (V-7), trajan red za fotke na tabletu (offline ①), bilo šta za servisera —
on `intake_orders.amend` nema.

⚠️ Ovaj dizajn je prošao **ukršteni prolaz od 6 uglova sa skeptikom na svaki nalaz** (70 nalaza,
40 preživelo, 13 blokera). Sve što je ispod je posle tih ispravki. Mesta na kojima je prvi nacrt
bio **pogrešan** su označena sa ⚠️ i zapisana namerno — da se za dva meseca ne vrati kao „ideja".

---

## 1. Odluke koje su donete pre dizajna

| # | Pitanje | Odluka | Ko |
|---|---------|--------|-----|
| ① | Telefon vlasnika je zamrznut zauvek — ostaje? | **Sme da se ispravi, uz žig.** Registracija i sve o vozilu ostaju zamrznuti. | Nikola, 08.08. |
| ② | Da li ispravka traži potvrdu? | **Pita jednom, na „Sačuvaj"**, i dijalog kaže šta žig znači. | Nikola, 08.08. |
| ③ | Serviser ne vidi žig dok ne osveži (SSE ne stiže do njegove role) | **Prihvaćeno kao poznata granica.** | Nikola, 08.08. |
| ④ | Gde žive fotografije | **Van režima izmene**, u tabu Fotografije, svaka radnja odmah. | Nikola, 08.08. |
| ⑤ | Napomena uz opremu dobija polje | **Da** (moja preporuka, prihvaćena „idemo sve po tvojoj preporuci"). ⚠️ Vidi §5 — ni prototip ni papir je ne nude. | Nikola, 09.08. |

---

## 2. Server

### 2.1 Telefon menja korpu

`assertPostSigningPatchAllowed` (`apps/api/src/modules/intake-orders/intake-orders.service.ts:392`)
danas deli polja u tri korpe:

- **slobodna:** `services`, `materials` — bez žiga, bez dozvole
- **zatečeno stanje:** `checklist`, `fuelLevel`, `damages`, `equipmentNote` — traže
  `intake_orders.amend` i **žigošu** nalog (`amended_at`/`amended_by`)
- **sve ostalo:** odbija se sa `ValidationError`

**Izmena:** `ownerPhone` prelazi iz treće korpe u drugu. Ostaju zamrznuti: `orderNumber`, `plate`,
`vehicle`, `vehicleType`, `vin`, `mileage`, `arrivalMode`, `ownerName`, `ownerAddress`,
`ownerRemarks`.

Polje je i dalje obavezno: 3–40 znakova posle trimovanja, **ne sme da se isprazni**. Zabrana se
proverava i na ekranu, jer serverovo odbijanje stiže kao neusmeren 400 koji ekran ume da prikaže
samo kao „radnja nije uspela" — operater ne bi znao koje polje je krivo.

### 2.2 ⚠️ BLOKER: žig nema vrstu — dve rečenice postaju netačne

Prvi nacrt je predlagao da se laž u Istoriji reši novim prelazom. **To je bilo pola rešenja.** Šest
uglova je nezavisno našlo isto: `amended_at` je **jedan bezimeni par kolona**
(`intake-orders.repository.ts:471-474`), i sa njega čita **četiri** površine, ne jedna:

| Površina | Odakle čita | Tekst danas |
|---|---|---|
| bedž u zaglavlju | `order.amendedAt` (`intake-detail-header.tsx:151`) | „⚠ Menjano posle potpisa" — **već je neutralan** |
| napomena uz potpise | `order.amendedAt` (`tab-overview.tsx:162-174`) | „**Zatečeno stanje** je menjano posle potpisa — {datum}, {ime}. Odštampani nalog kod mušterije nije identičan ovom zapisu." |
| marker u listi | `item.amendedAt` (`intake-orders-table.tsx:112-116`) | „**Zatečeno stanje** je ispravljeno posle potpisa" |
| red u Istoriji | `changes->>'transition'` (`history-labels.ts:12-20`) | „Zatečeno stanje menjano posle potpisa" |

Prelaz vidi **samo poslednja**. Da smo pustili samo njega, ispravka telefona bi na dve žive
površine tvrdila da je promenjeno zatečeno stanje vozila — tačno laž zbog koje je pola ove sekcije
i postojalo.

**Odluka: dve rečenice se pišu neutralno, žig ostaje jedan, migracije nema.** Neutralna rečenica je
i dalje potpuno tačna za oba slučaja (odštampani nalog kod mušterije zaista više nije identičan
zapisu i kad je promenjen samo telefon), a **specifičnost nosi Istorija**, koja jedina zna vrstu.

Četiri niske za tvoju reč (sr; `en.json` dobija par u istom komitu — CI proverava parnost):

| Ključ | Danas | Predlog |
|---|---|---|
| `intake_signature_note_amended` | „Zatečeno stanje je menjano posle potpisa — {date}, {name}. Odštampani nalog…" | „**Nalog je menjan** posle potpisa — {date}, {name}. Odštampani nalog kod mušterije nije identičan ovom zapisu." |
| `intake_amended_hint` (marker u listi) | „Zatečeno stanje je ispravljeno posle potpisa" | „**Nalog je menjan posle potpisa**" |
| `intake_history_amended` | „Zatečeno stanje menjano posle potpisa" | **nepromenjeno** — Istorija sme i treba da bude precizna |
| `intake_history_amended_contact` (nov) | — | „Telefon vlasnika izmenjen posle potpisa" |

Odbačene alternative: zasebna kolona `contact_amended_at` (migracija, a fazu smo držali bez nje) ·
ostaviti telefon zamrznut (obara odluku ①) · ćutati i pustiti netačnu rečenicu.

`docs/25` §3.5 opisuje i marker na štampi (`⚠ ZATEČENO STANJE ISPRAVLJENO POSLE POTPISA`) — **nije
sagrađen**, V-7 je i dalje bez specifikacije. U `docs/25` se upisuje da marker nasleđuje neutralnu
formulaciju, da V-7 ne krene od netačne.

### 2.3 ⚠️ Sačuvaj šalje razliku, ne ceo bafer

Ako ekran pošalje ceo bafer, **svako** čuvanje nosi i `checklist` i `damages` i `fuelLevel`, pa bi
i ispravka samo telefona bila obeležena kao izmena zatečenog stanja — cela §2.2 bi bila nedostižna
u praksi. Zato:

- „Sačuvaj" poredi bafer sa učitanim nalogom **polje po polje** i šalje **samo promenjene ključeve**
- `checklist` i `damages` se porede **po vrednosti**, ne po referenci
- `equipmentNote` i `ownerPhone` se porede **trimovano** (Zod ionako trimuje na serveru); prazna
  napomena se šalje kao `null`, po obrascu koji čarobnjak već ima
  (`optionalText(...) ?? null`, `intake-wizard-state.ts:74,119` — funkcija vraća `undefined`, pa
  `?? null` nije ukras). `optionalText` se izvozi umesto da se piše drugi put
- **prazna razlika = nema zahteva**, i to se proverava **pre** otvaranja dijaloga (inače operater
  potvrdi trajan žig pa se ne desi ništa)

### 2.4 ⚠️ Ista zaštita ide i u servis

Pravilo „nema promene → nema žiga" u prvom nacrtu je bilo **samo na ekranu**. Žig je trajan i
štampa se; jedna greška u poređenju, dupli klik ili bilo koji drugi pozivalac ožigoše nalog
zauvek. Zato servis pri zahtevu na potpisan nalog **odbacuje ključeve čija je vrednost jednaka
zatečenoj**, i ako posle toga ne ostane ništa, to nije izmena: bez žiga, bez reda u Istoriji.
Jedna straža na mestu kroz koje prolaze svi, umesto poverenja u ekran.

### 2.5 Prelaz u Istoriji

`updateTransition` (`:79`) je namerno zatvorena unija. Dobija treću vrednost. Kad zahtev dira i
zatečeno stanje i telefon, **stanje pobeđuje** i red je jedan.

Šta mora da nauči novu vrednost: unija u `updateTransition` · bogatiji povratak iz
`assertPostSigningPatchAllowed` (danas vraća `boolean`) · `TRANSITION_LABELS`
(`history-labels.ts:12-20`) i njegov komentar „Complete against the server" · nov par ključeva u
`sr.json` i `en.json`. **SQL filter istorije se NE dira** — `COALESCE` u njemu je noseći
(`intake-orders.repository.ts:674-676`), a nova vrednost prolazi jer nije `NULL`. Nemapirana
vrednost tiho ispadne na „Nalog izmenjen" (`history-labels.ts:48`), pa je par ključeva obavezan, ne
opcion.

---

## 3. Ekran — tab Pregled

### 3.1 ⚠️ Gde živi stanje (prvi nacrt je ovo pogrešio)

Prvi nacrt je rekao „stanje u tabu". Ne može: zaglavlje i telo taba su **braća** ispod komponente
rute (`routes/_shell/prijem/$id.tsx:61-106`), a telo se bira mapom na `:97-106`, pa promena taba
**demontira `TabOverview`** i sa njim bafer. Ni URL nije rešenje — linkovi tabova šalju
`search={{ tab }}` (`intake-detail-tabs.tsx:64-69`), običan objekat koji **zamenjuje ceo** search,
pa bi svaka zastavica otpala na prvi klik.

**Odluka:**

- `editMode` + bafer žive u `IntakeDetailPage` (`routes/_shell/prijem/$id.tsx`), iznad tabova
- zaglavlje dobija `canAmend` + `onStartEdit`; telo dobija bafer i `onChange`
- ulazak u režim **eksplicitno** vodi na `?tab=pregled` (`replace`) — prototip to isto radi
  (`startEdit: setState({ editMode: true, tab: 'pregled', … })`), a kod nas bez toga dugme
  pritisnuto sa Fotografija ne montira ništa
- **dok je režim otvoren, traka tabova je zaključana**, i zaključane su radnje u zaglavlju
  (napreduj / ukloni / ispravka statusa). Jedan režim u jednom trenutku; nema tihог gubitka
  bafera i nema drugog dijaloga. Izlaz je „Otkaži" ili „Sačuvaj".

### 3.2 ⚠️ Šta postaje izmenjivo — bez ijedne nove kartice

Prvi nacrt je prepisao prototipovu **novu karticu** GORIVO + ČEK-LISTA. To bi na našem ekranu
prikazalo ček-listu **dva puta** (jednom mrtvu, jednom živu, na pedalj razmaka), jer mi tu karticu
već imamo — prototip je nema u čitalačkom prikazu. Ispravno je ono što je dizajn i obećao dva reda
ranije: **postojeće kartice postaju izmenjive na mestu.**

| Kartica | U režimu izmene |
|---|---|
| **Šema** | kursor krstić, tap dodaje marker izabranog tipa; ispod šeme 2×2 dugmadi tipova (170px, 40px, gap 6) |
| **Nedostaci** | svaki red dobija **✕** (34×40) — briše marker; **fotke ostaju**, samo gube brojčić (server to već radi u transakciji) |
| **Zatečeno stanje** | ✓/✗/— mreža se menja u `IntakeChecklistGrid` (živi DA/NE), a ispod nje ide **napomena uz opremu** kao polje |
| **Osnovni podaci** | „Gorivo" postaje `N/8` sa `−`/`+` (44px); „Telefon" postaje polje |

Dve stvari koje dolaze besplatno i zato se ne prepisuju iz prototipa:

- `IntakeChecklistGrid` **vraća red u „nije provereno" na ponovni dodir**. Prototipova DA/NE
  kontrola to ne ume — kancelarija bi mogla da ožigoše dokument u lažno „NE" i da nema puta nazad.
  Cena: dugmad su `h-12`/62px umesto prototipovih 52×44. **Treće stanje pobeđuje brojku**, i to je
  zapisano odstupanje.
- `IntakeDamageMap` sam prelazi na krstić kad dobije `onPlace`, a zonu izvodi server.

⚠️ Dok se menja, mreža fotografija se hrani **baferovim** oštećenjima, ne `order.damages` — inače
brojčići na fotkama pokazuju stanje pre izmene.

### 3.3 Otkaži / Sačuvaj

„Otkaži" vraća sve i izlazi (bez pitanja — ništa nije otišlo na server). „Sačuvaj" pita **jednom**
(odluka ②); dijalog kaže da žig ostaje trajno, da se štampa, i — ako je obrisan marker — **da
njegove fotografije gube vezu**. Zatim ide jedan zahtev, jedan red u Istoriji, jedan žig, pa toast.

Pojedinačan ✕ **ne pita** — bafer se otkazuje u celini, pa bi potvrda po markeru bila potvrda ni za
šta. To je namerno drugačije od čarobnjaka, gde ✕ pita jer briše odmah.

### 3.4 Brojke (iz prototipa, doslovno)

- dugme „Ispravi zatečeno stanje": 46px, padding 0 18, radius 10, `1px solid rgba(245,165,36,.45)`,
  `rgba(245,165,36,.12)`, boja amber, 13px/800/uppercase/`.06em`
- traka: padding 13/16, radius 12, `rgba(245,165,36,.09)`, ivica `rgba(245,165,36,.4)`, gap 14;
  oznaka „REŽIM IZMENE" mono 10px/700/`.16em`; rečenica 13.5px/1.5
- „OTKAŽI" 44px, padding 0 16, radius 9, providno, `border2`, mono 12px/700
- „✓ SAČUVAJ IZMENU" 44px, padding 0 20, radius 9, `rgba(31,169,113,.16)`, ivica
  `rgba(31,169,113,.45)`, zelena, mono 12px/800
- tip oštećenja: 40px, radius 8, 11.5px; izabran → `rgba(237,28,36,.13)` + ivica
  `rgba(237,28,36,.42)` + `redh` + 700
- gorivo: cifra mono 26px/800, „/8" 16px `text2`; `−`/`+` 44px, radius 9, `inbg`, mono 17px/600
  (znak je U+2212, ne minus sa tastature)
- ✕ na nedostatku: 34×40, providno, `text2`, 15px

Boje idu **isključivo** kroz `mri-*` klase — `var(--mri-warn)` i drugovi se ne razrešavaju u
internal-web-u (CLAUDE.md §5).

---

## 4. Fotografije — tab Fotografije, van režima

Kancelarija sa pravom dobija `+` ćeliju (kamera/galerija) i brisanje kroz pregled fotke.
`IntakePhotoLightbox` već prima `onDelete` — čarobnjak ga šalje, **detalj ne**. Svaka radnja:
potvrda → odmah na server → žig → red u Istoriji.

**Uslov za obe radnje: `amend` I `update`, i nalog potpisan i neuklonjen.** Zasejane role imaju oba
prava, ali rola napravljena iz admina sa `amend` bez `update`-a bi dobila `+` čiji je svaki dodir
403 sa rute. Nacrt i uklonjen nalog su izvan ovoga (server ionako odbija svaki upload na uklonjen).

⚠️ **Red za slanje mora da živi na strani, ne u tabu.** `useIntakePhotoQueue(order.id)` se poziva u
`IntakeDetailPage` i prosleđuje tabu — isto podizanje koje je čarobnjak već napravio. Inače
kancelarijski upload koji padne ili čeka mrežu **izgubi i ćeliju i „ponovi" i osluškivač mreže** čim
operater pređe na Pregled, a `photos_expected` se diže tek posle uspeha
(`intake-orders.service.ts:682-685`) — dakle od neuspelog slanja ne ostane trag ni na ekranu ni na
serveru. Uz to: neuspeh se javlja i toastom, jer ćelija je jedina postojeća poruka o padu, a
operater ne mora da stoji na tom tabu.

⚠️ **Brisanje je dve stvari, ne jedna.** Ćelija čiji je upload stigao je i red na serveru i stavka
u redu za slanje (red ne čisti stigle stavke — `intake-photo-grid.tsx:83` ih samo sakriva kad se
pojave u serverskoj listi). Brisanje bez `queue.discard(entryId)` vraća obrisanu fotku na ekran kao
slanje u toku. Potvrda stoji **kod pozivaoca**, kao u čarobnjaku — ne unutar lightbox-a, da se
ponašanje čarobnjaka ne menja usput.

⚠️ **Serviserova zakasnela fotka i dalje ide bez žiga** (server gleda identitet:
`intake-orders.service.ts:628-649`). Zato tekst potvrde bira po tome da li je onaj ko dodaje
**tehničar tog naloga** — inače dijalog obeća trajan žig, a ne desi se ništa. Kod brisanja server
identitet **ne gleda** (`:725`), pa je i serviserovo brisanje sopstvene fotke zabranjeno posle
potpisa; to ostaje kako jeste.

⚠️ **`+` ne gasi traku „nisu sve fotke stigle".** Očekivani broj diže samo zakasnela isporuka sa
tableta, a `+` diže i očekivano i stiglo. Traka na trajno izgubljenoj fotki ostaje zauvek —
odvojena stavka, ne nešto što `+` tiho reši.

Izgled taba ostaje prototipov (4 u redu, natpisi `IMG_01`); iz čarobnjakove mreže se izdvajaju samo
biračica fajlova i prikaz stanja slanja, da se ne pišu drugi put. **Lightbox na Pregledu ostaje bez
brisanja** — jedna radnja na jednom mestu.

---

## 5. Odstupanja koja se prijavljuju (papir i prototip)

Handoff doslovno kaže: *„U režimu izmene su izmenjivi: šema (tap dodaje oštećenje, ✕ briše),
ček-lista (DA/NE), gorivo (±), dodavanje fotki. **Ostalo ne.**"*

1. **Telefon** — dodat po odluci ①. Nije ni u prototipu ni u papiru.
2. **Napomena uz opremu** — dodata po ⑤. Nije ni u prototipu ni u papiru. Razlog: server je već
   pušta, pa bi inače ostala „sme da se ispravi, a nema gde".
3. **Nema nove kartice** za gorivo i ček-listu (§3.2) — postojeće postaju izmenjive.
4. **Ček-lista je 62px umesto 52×44** — zbog trećeg stanja (§3.2).
5. **Fotke su van režima izmene** (odluka ④) — prototipov „Otkaži" vraća i njih, naš ne može.
6. **Dve rečenice o žigu postaju neutralne** (§2.2).

`docs/25` se dopunjava u istom komitu: §3.3.9 i §6 dobijaju `ownerPhone`, obrazloženje o zamrznutim
poljima se prepisuje, a marker za štampu se opisuje neutralno. Papirno uputstvo radnika je i dalje
tačno u onome što servisera dodiruje — ispravlja se pri sledećem štampanju.

---

## 6. Poznate granice (prihvaćene, zapisane)

- **③ serviser vidi žig tek na osvežavanju** — SSE ne stiže do njegove role.
- **Dva operatera u isto vreme** na istom nalogu: pobeđuje poslednji, oba dobiju žig i red u
  Istoriji. Razlika po poljima (§2.3) sužava sudar na isto polje. Nije radni tok koji postoji.
- **Fotka koja nikad nije stigla** se ne šalje ponovo (offline ①), i traka o njoj ostaje.

---

## 7. Fajlovi

**Server** — `intake-orders.service.ts` (korpa, prelaz, odbacivanje nepromenjenih ključeva) ·
`__tests__/intake-orders.integration.test.ts`.

**Zajedničko** — `packages/i18n/src/messages/sr.json` + `en.json` (4 izmene + novi ključevi za
dugme, traku, dijaloge i toaste). Posle izmene: `pnpm --filter @mr/i18n run compile`.

**Ekran** — `routes/_shell/prijem/$id.tsx` (stanje, red za slanje, navigacija na Pregled) ·
`detail/intake-detail-header.tsx` (dugme, zaključavanje radnji) · `detail/intake-detail-tabs.tsx`
(zaključana traka) · `detail/tab-overview.tsx` + izdvojene kartice (v. dole) ·
`detail/tab-photos.tsx` · izdvojena biračica iz `wizard/intake-photo-grid.tsx` · novi
`detail/use-intake-amend.ts`.

⚠️ `tab-overview.tsx` je već 368 redova, a kućno pravilo zabranjuje fajlove preko 500. Kartice
„Zatečeno stanje" i „Nedostaci" se izdvajaju u svoje fajlove i primaju neobavezne props-e za izmenu
— isti fajl služi oba prikaza, i nijedan ne raste u čudovište.

**Dokumentacija** — `docs/25`.

---

## 8. Čime se dokazuje

**Integracioni (api):** ispravka telefona iz kancelarije prolazi, žigoše i upisuje nov prelaz ·
serviserova ispravka telefona → 403 · `ownerName` i dalje odbijen · zahtev koji dira i stanje i
telefon piše **jedan** red sa prelazom za stanje · zahtev sa nepromenjenim vrednostima **ne žigoše
i ne upisuje ništa**. (⚠️ Nijedan postojeći test ne pocrveni od ove izmene — zamrznut telefon nikad
nije bio pokriven, pa je promena nevidljiva celom gejtu dok se ovi testovi ne napišu.)

**Komponentni (internal-web):** „Otkaži" vraća sva četiri polja · „Sačuvaj" bez izmene ne šalje
zahtev i ne otvara dijalog · dugmeta nema bez prava, na nacrtu i na uklonjenom nalogu · traka
tabova je zaključana dok režim traje · brisanje fotke zove i server i `discard` · `+` se ne
prikazuje roli sa `amend` bez `update`.

**Mutacije** po obrascu koji radi: svaka nova klauzula se obara i gleda se da li pocrveni tačno
njen test.

**Brauzer:** ceo krug na 1180×820 (kancelarijski iPad) i na desktopu — ulazak, izmena sva četiri
polja, otkazivanje, čuvanje, žig na sve četiri površine, red u Istoriji, dodavanje i brisanje
fotke.

---

## 9. Šta ovo ne dira

Štampu (V-7 je i dalje bez specifikacije i njena premisa je odbijena 27.07.) · trajan red za fotke
na tabletu · servisera · portal (prijem ga ne dodiruje) · statistiku i Excel.
