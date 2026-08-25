# Čet — ispravna pravila niti i upravljanje kanalima

**Status:** odobren dizajn · **Datum:** 25.08.2026. · **Obim:** `internal-web` + `api` +
`shared`, bez migracije i bez nove dozvole

Ovaj dokument dopunjuje:

- `2026-08-23-cet-razgovori-design.md` — osnovni model i životni ciklus niti;
- `2026-08-24-cet-kanali-design.md` — privatnost i vlasništvo kanala.

Kasnija odluka vlasnika iz ovog dokumenta ima prvenstvo gde se stariji tekst razlikuje: kanal se
pravi sa izabranim članovima; tvorac briše svoj kanal; admin upravlja i briše svaki tematski
kanal kroz pregled metapodataka, ali time ne dobija pravo da čita njegove poruke ili priloge.
Tvorac kroz isti pregled zadržava upravljanje sopstvenim kanalom i ako ga je prethodno napustio.

---

## 1. Problem koji se zatvara

### 1.1 Lažno „NAPRAVI NIT“

Zaključana nit namerno ne ulazi u `GET /api/chat/conversations`, ali dijalog „Nova nit“ koristi
baš tu aktivnu listu kao dokaz da nit postoji. Zbog toga prihvaćena, odbijena ili arhivirana
reklamacija izgleda kao da nema nit. Klik zatim:

1. pozove outcome-blind `POST /api/chat/claims/:kind/:id/thread`;
2. napravi novu već zaključanu nit ili vrati postojeću;
3. prikaže toast „Nit napravljena“;
4. osveži aktivnu listu, koja tu nit ponovo izostavi;
5. vrati ekran na Opšti kanal.

Pravila su pojedinačno smislena, ali zajedno daju lažan uspeh.

Istu active-list pretpostavku koriste MR predlog iz composera i klik na MR čip u poslatoj poruci,
pa zatvorena reklamacija i tamo lažno izgleda kao kandidat za prvu nit.

### 1.2 Kanal se pravi bez ljudi

Deljena šema već definiše `{ name, memberIds }`, dok produkcioni kontroler i klijent šalju samo
ime. Naknadno upravljanje članovima postoji, a server već čuva pravilo „tvorac ili admin“, ali:

- ekran svakom članu prikazuje kontrole koje će server odbiti;
- tvorac ne može da izabere ljude pri pravljenju;
- admin koji nije član ne može da upravlja kanalom bez dobijanja pristupa razgovoru;
- online dodat ili uklonjen korisnik ne dobija odmah osveženu listu kanala.

### 1.3 Brisanje nije u skladu sa novom odlukom

Postojeće bezbedno brisanje čisti obaveštenja, fajlove i red razgovora i piše jedini audit red
koji modul četa treba da piše. Autorizacija je, međutim, admin-only. Nova odluka je:

- tvorac briše svoj tematski kanal;
- admin briše svaki tematski kanal;
- Opšti kanal se ne briše;
- nit reklamacije ostaje pod postojećim admin-only pravilom.

---

## 2. Zaključane odluke

1. `pending` je jedino otvoreno stanje reklamacije. `accepted`, `rejected` i `archived` su zatvorena.
2. Prva nit može nastati samo dok je reklamacija otvorena.
3. Nit koja je postojala pre zatvaranja ostaje istorijski dokaz na tabu „Razgovor“ reklamacije,
   samo za čitanje. Ne stoji u glavnoj listi Razgovora ni u dijalogu „Nova nit“.
4. Vraćanje outcome-a na `pending` automatski vraća istu nit u aktivnu listu i ponovo dozvoljava
   slanje. Ne postoji zasebna lock kolona.
5. Kanal pri nastanku prima ime i nula ili više izabranih članova; tvorac je uvek član.
6. Tvorac ili admin dodaju i sklanjaju druge ljude. Svaki član, uključujući tvorca, može da napusti
   kanal uz potvrdu; napuštanje ne menja vlasništvo.
7. Dodati član dobija pristup celoj postojećoj istoriji kanala. UI to mora jasno reći pre potvrde.
8. Tvorac trajno briše svoj kanal; admin trajno briše svaki tematski kanal.
9. Admin upravlja kanalima bez automatskog prava čitanja. Pristup porukama i prilozima i dalje
   zahteva članstvo.
10. Tvorac/admin koji više nije član može svesno da doda i sopstveni nalog; tek taj eksplicitni
    membership grant otvara istoriju, uz isto upozorenje kao za dodavanje bilo koga drugog.
11. Nema nove chat dozvole. Admin se proverava po sistemskoj ulozi, kao i danas.

---

## 3. Niti reklamacija

### 3.1 Aktivni dijalog

`NewThreadDialog` koristi postojeći objedinjeni spisak reklamacija sa
`outcome=pending`. Filtriranje je serversko, pa pretraga na narednim stranama ne može vratiti
zatvorenu reklamaciju. Aktivna lista razgovora i dalje je dovoljna da kaže `NIT POSTOJI` za
otvorenu reklamaciju.

UI filter je samo ljubaznost. Server ostaje sudija.

### 3.2 MR prečice u razgovoru

Isti uslov važi za još dva postojeća ulaza: predlog iz MR broja koji se upravo kuca i MR čip u već
poslatoj poruci. Beskonačno keširan MR registry ostaje nepromenljiva mapa `{ kind, claimId }`; u
njega se ne stavlja promenljiv outcome niti se širi podatak korisniku koji možda ne sme da čita tu
vrstu reklamacije.

Tek poslednji prepoznati MR u composeru, odnosno stvarni klik na poslati čip, pita read-only thread
lookup iz §3.3. To je najviše jedan dodatni zahtev za stvarnu interakciju, keširan po
`(kind, claimId)`, a ne zahtev za svaki MR čip u istoriji poruka.

- dok je reklamacija `pending`, predlog i čip zadržavaju postojeće ponašanje: otvaraju aktivnu nit
  ili nude njeno pravljenje;
- za zatvorenu reklamaciju composer ne prikazuje zeleno `NAPRAVI +`;
- klik na MR čip zatvorene reklamacije vodi na tab „Razgovor“ same reklamacije, gde se istorijska
  nit čita ako postoji; nikad ne otvara create potvrdu.

### 3.3 Čitanje bez kreiranja

Dodaje se read-only ruta:

```text
GET /api/chat/claims/:kind/:id/thread
```

Odgovor je:

```ts
{
  conversation: ChatConversationListItem | null
  canCreateThread: boolean
}
```

`conversation=null` znači da čitljiva reklamacija nikada nije imala nit. `canCreateThread=true`
važi samo za `pending` reklamaciju bez niti. Nalog koji ne sme da čita tu vrstu reklamacije,
nepostojeća reklamacija i meko obrisana reklamacija dobijaju 404, kao i na ostatku chat modula.

Ruta nikad ne piše red, sistemsku poruku, audit ili signal. Query ključ uključuje i `kind` i
`claimId`.

Tab „Razgovor“ na detalju reklamacije koristi aktivnu listu dok je reklamacija `pending`, a ovu
read-only rutu kada je zatvorena. Taj hibrid je nameran: postojeći chat signal već osvežava aktivnu
listu kada drugi korisnik napravi nit, pa svaki događaj poruke u firmi ne izaziva novi lookup
zatvorene niti.

| stanje | postojeća nit | prikaz |
| --- | --- | --- |
| `pending` | ne | prazno stanje + „Napravi nit“ |
| `pending` | da | aktivna nit |
| zatvoreno | ne | mirno prazno stanje, bez dugmeta |
| zatvoreno | da | ista nit, samo za čitanje |

„Samo za čitanje“ znači da server na zaključanoj niti vraća 422 za slanje, izmenu, povlačenje
poruke, pin/unpin i reaction/unreaction, a UI uopšte ne crta te kontrole. Dozvoljeni ostaju čitanje
i preuzimanje priloga, view-tracking (`mark-read`), lični mute/unmute, sistemske poruke koje piše
claim servis i adminovo brisanje pogrešno napravljene niti.

Claim outcome događaj poništava tačan lookup ključ i aktivnu listu razgovora. Signal brisanja
poništava lookup samo kada njegov keširani conversation id odgovara obrisanom id-u; ne poništava
sve lookup-e na svaku običnu chat poruku.

### 3.4 Autoritativno pravljenje

Postojeći POST ostaje idempotentan:

```text
POST /api/chat/claims/:kind/:id/thread
```

- otvorena reklamacija bez niti → 201 i jedna nit;
- otvorena reklamacija sa niti → 200 i ista nit;
- zatvorena reklamacija → 422 i nijedan novi red;
- nečitljiva/nepostojeća/meko obrisana reklamacija → 404.

Repository koristi jednu transakciju: `SELECT … FOR UPDATE` zaključava red reklamacije, proverava
da je živ i `pending`, zatim radi postojeći get-or-create i, samo za stvarno novi conversation,
upisuje jedan `thread_created` red pre commita. Tek posle commita servis objavljuje signal. Promena
outcome-a i pravljenje niti zato ne mogu proći jedno pored drugog, a pad procesa ne može ostaviti
nit bez njenog creation reda.

Za 422 UI prikazuje da se nova nit pravi samo dok je reklamacija otvorena; nikakav success toast ni
navigacija se ne izvršavaju.

Posle 200/201 klijent poništava tačan read-only lookup i **čeka** refetch aktivne liste pre
navigacije. Ako vraćeni id stoji u aktivnoj listi, navigira u nit i prikazuje istinito „Nit
otvorena“. Ako je drugi zahtev u međuvremenu zatvorio reklamaciju, id legitimno više nije aktivan:
klijent proverava read-only lookup, vodi na tab „Razgovor“ reklamacije i kaže da je nit sačuvana uz
zatvorenu reklamaciju. Ako je nit u međuvremenu obrisana, prikazuje da više nije dostupna. Nijedna
grana ne pada ćutke na Opšti kanal.

---

## 4. Pravljenje kanala sa članovima

### 4.1 Ulaz i UI

Produkcioni POST koristi već postojeću deljenu `ChatChannelCreateInputSchema`:

```ts
{ name: string; memberIds: string[] }
```

Dijalog sadrži:

- ime kanala;
- lokalnu pretragu malog spiska zaposlenih;
- višestruki izbor ljudi;
- objašnjenje da član dobija pristup celom razgovoru, uključujući raniju istoriju kada se dodaje
  naknadno;
- jedno dugme „Napravi kanal“.

Spisak se učitava samo dok je dijalog otvoren, preko postojećeg `/people` odgovora Opšteg kanala.
Taj odgovor već predstavlja aktivne naloge koji stvarno drže neku od `INTERNAL_APP_PERMISSIONS`,
uključujući admin bypass. Tvorac se ne nudi za izbor jer se dodaje automatski.

### 4.2 Jedan zahtev, sve ili ništa

Repository u jednoj transakciji:

1. pravi `chat_conversations` red sa `created_by`;
2. ponovo proverava sve `memberIds` prema istom server-side uslovu za ulaz u internu aplikaciju;
3. ubacuje tvorca i jedinstvene izabrane korisnike u `chat_members`;
4. piše tačno jednu postojeću `channel_created` sistemsku poruku;
5. vraća nov kanal i id te poruke, a servis objavljuje postojeći chat signal tek posle uspešnog
   commita.

Ako je makar jedan poslati id neaktivan, obrisan, portalski ili bez prava ulaska u internu
aplikaciju, zahtev je 422 i cela transakcija se vraća. Nema delimično napravljenog kanala i nema
tiho izostavljenog člana.

Granica ostaje najviše 200 izabranih id-jeva. Dvostruki id i id tvorca ne prave duplikat.

---

## 5. Naknadno upravljanje članovima

### 5.1 Običan panel kanala

Postojeći members odgovor dobija server-derived `canManage`:

```ts
{ members: ChatPerson[]; addable: ChatPerson[]; canManage: boolean }
```

- `canManage=true` za tvorca i admina;
- `addable` se čita samo kada je `canManage=true`;
- običan član dobija roster, `addable: []` i `canManage=false`;
- `createdBy` se ne šalje klijentu.

UI prikazuje „Dodaj“ i ✕ pored drugih ljudi samo kada je `canManage=true`. Pored sopstvenog imena
nikad nema ✕; izlazak ostaje zasebno dugme sa `ConfirmDialog`-om.

I create-time i later-add write koriste isti server-side predikat za dozvoljene članove. Naknadno
dodavanje u jednoj transakciji deduplikuje id-jeve, proverava ceo skup i tek onda ubacuje članove.
Nevažeći id vraća 422 i rollback ne dodaje nikoga iz tog zahteva.

### 5.2 Upravljanje bez čitanja

Mali modal „Upravljanje kanalima“ stoji pored grupe KANALI i učitava se samo kada ga korisnik
otvori. Tvorcu prikazuje kanale koje je napravio, a adminu sve tematske kanale. Zbog toga tvorac
može da upravlja ili obriše svoj kanal i kada ga je napustio, bez ponovnog dobijanja pristupa
razgovoru.

Read ruta je:

```text
GET /api/chat/channels/manage
```

Management lista je pretraživa po nazivu i vraća najviše 50 redova po strani. Svaki red nosi samo:

- id i naziv tematskog kanala;
- ime tvorca ili „Nalog ugašen“;
- broj članova;
- akciju otvaranja upravljanja i brisanja.

Tek izbor jednog kanala učitava njegov roster i addable spisak kroz postojeću members rutu. Tako
admin sa mnogo kanala ne pravi N+1 zahteva niti povlači sve članove svih kanala da bi prikazao
prvih 50 naziva.

Nijedan odgovor tog management toka ne nosi poruke, telo poruke, pinove ili priloge. Obični read
endpoint-i (`messages`, `attachments`, `pins`) zadržavaju postojeće membership pravilo.

Ukida se postojeći izuzetak po kom admin vidi običan sadržaj kanala čim broj članova padne na nulu.
I legacy prazan kanal sa starim porukama postoji adminu samo u management listi; obična lista,
messages i attachments vraćaju 404 dok admin izričito ne doda sopstveni nalog u članove.

Server vraća kanale po autoritativnom pravilu `created_by = actor.id OR actor is admin`; običan
korisnik ne može promenom parametra da vidi tuđe kanale. Nema nove dozvole i nema owner/admin
bypass-a u običnoj listi razgovora.

Postojeće rename/add/remove/delete rute za tematski kanal dobijaju odvojen metadata management
guard. On dozvoljava tvorcu svog i adminu svaki kanal i kada nisu članovi; nikada se ne koristi na
messages/attachments/pins rutama. Običan panel i ovaj modal dele iste mutation funkcije, pa ne
postoje dve implementacije upravljanja.

Rename PATCH vraća 204, ne `ChatConversationListItem`: vlasnik koji je napustio kanal ne može biti
ponovo pročitan kroz membership projekciju, a management odgovor ne sme da procuri unread/last
message metapodatke. Klijenti dobijaju nov naziv kroz invalidaciju.

### 5.3 Osvežavanje drugih korisnika

Kreiranje, preimenovanje, svaka uspešna batch promena rostera i brisanje objavljuju tačno jedan
postojeći chat signal; ne uvodi se novi event tip i ne objavljuje se signal po članu. Klijent na
isti signal dodatno poništava `chatKeys.members(conversationId)`,
`chatKeys.people(conversationId)` i management listu uz postojeću listu razgovora.

Zbog kompatibilnog rolling deploya postojeći payload zadržava polje `messageId`. Za običnu i claim
sistemsku poruku ono nosi pravi id poruke. Za svaku channel-metadata promenu — uključujući create,
rename, roster i delete — nosi `conversationId` kao dokumentovan opaque invalidation token. Klijent
zato management/members/people ključeve poništava samo kada je `messageId === conversationId`, ne
na svaku poruku u firmi. Nijedan consumer token ne dereferencira niti iz njega zaključuje da je
nastala nova korisnička poruka.

Posledice:

- dodatom online korisniku kanal se pojavi bez reload-a;
- uklonjenom online korisniku kanal nestane i otvoren ekran padne na Opšti kanal;
- obrisan kanal nestane svim dotadašnjim članovima;
- otvoreni roster kod ostalih članova se osveži.

Signal je i dalje signal-only i ne nosi ime kanala, ime člana niti tekst poruke.

---

## 6. Brisanje

Autorizacija postojeće DELETE rute postaje zavisna od vrste razgovora:

| vrsta | ko sme |
| --- | --- |
| `general` | niko, 422 |
| `channel` | tvorac tog kanala ili admin |
| `claim` | admin, postojeće pravilo |

Za kanal se koristi metadata-only management lookup, pa admin može obrisati kanal u kom nije član
bez mogućnosti da prethodno pročita poruke. Ne-admin koji nije tvorac dobija 404 ako kanal ne vidi,
a 403 ako je član i pokušava da upravlja tuđim kanalom.

UI:

- tvorac dobija „Obriši kanal“ u panelu svog kanala;
- tvorac dobija istu akciju i u management modalu za svoje kanale, čak i kada više nije član;
- admin dobija istu akciju u management modalu za svaki tematski kanal;
- svako brisanje prolazi kroz destruktivni `ConfirmDialog` koji jasno kaže da nestaju poruke i
  prilozi i da se radnja ne može vratiti.

Ispod autorizacije se ne pravi drugi put brisanja. Send putanja prvo uzima PostgreSQL session-level
**shared advisory lock** izveden iz conversation id-a i drži ga kroz upis poruke, skladištenje
fajlova i upis mention obaveštenja. Više slanja i dalje radi paralelno. Delete uzima **exclusive**
lock na istom ključu: sačeka započeta slanja i ne pušta novo da prođe proveru vidljivosti dok red
ne nestane. Lock koristi jednu namensku pooled konekciju i uvek se oslobađa u `finally`; pad procesa
ga oslobađa zatvaranjem konekcije. Tako radi i sa više Railway API replika, bez Redis locka.
Svi DB koraci fenced operacije koriste isti leased executor — implementacija ne sme da drži lock
na jednoj konekciji pa traži drugu iz istog poola, jer bi burst mogao sam sebi da iscrpi pool.

Pod tim fence-om koristi se postojeći redosled, ali bez neograničenog niza message UUID-eva u Node
memoriji:

1. prebroji poruke sa `COUNT(*)` za audit;
2. skloni notification redove jednim conversation-scoped SQL podupitom;
3. obriši sa skladišta sve chat fajlove i thumbnail-e;
4. tvrdo obriši conversation red, a FK cascade uklanja decu;
5. upiši audit sa actorom, vrstom, nazivom i brojem obrisanih poruka;
6. posle uspeha objavi jedan postojeći signal da kanal nestane ostalim članovima.

Chat ostaje imenovani izuzetak audit pravila: nijedna druga chat mutacija ne dobija audit red.

---

## 7. Greške i bezbednost

- 404 čuva postojanje reklamacije/kanala od naloga koji ih ne sme videti.
- 403 znači: kanal je vidljiv, ali njime upravlja neko drugi.
- 422 znači: zatvorena reklamacija, Opšti kanal ili nevažeći izbor člana.
- Server nikad ne veruje UI `canManage` vrednosti ili ponuđenom rosteru.
- Portalski klijent i nalog bez `INTERNAL_APP_PERMISSIONS` ne mogu postati članovi ni direktnim
  HTTP zahtevom.
- Management metadata endpoint ne poziva message/file repository metode.
- Dodavanje ostaje idempotentno za već postojećeg člana; uklanjanje već odsutnog člana je 204.
- Opšti kanal je odbijen na svakoj management mutaciji, ne samo na brisanju.

---

## 8. Trošak i složenost

Ova promena dodaje:

- jedan read-only lookup niti;
- jednu metadata listu kanala skopiranu na tvorca/admina;
- postojećem create zahtevu `memberIds`;
- nekoliko uslova i UI kontrola nad postojećim tabelama/rutama.

Ne dodaje:

- tabelu, kolonu, indeks ili migraciju;
- novu dozvolu ili `db:seed`;
- Redis strukturu, queue, worker, outbox ili polling;
- novi Railway servis ili dependency;
- novi realtime event tip.

Roster se čita samo pri otvaranju dijaloga/panela, a management lista samo pri otvaranju modala.
Management odgovor je straničen na 50 metapodataka; roster se čita samo za jedan izabrani kanal.
Kreiranje ostaje jedan HTTP zahtev i jedna DB transakcija. Send fence dodaje dve kratke PostgreSQL
komande (shared lock/unlock) po zahtevu i koristi postojeći ograničeni pool; nema čekanje u petlji,
red u memoriji ni rad po broju članova. Exclusive lock se koristi samo pri retkom trajnom brisanju.

---

## 9. TDD dokaz

Svaka izmena počinje crvenim testom.

### Niti

1. `accepted|rejected|archived` reklamacija bez niti → POST 422 i nula conversation redova.
2. Zatvorena reklamacija sa postojećom niti → GET vraća `isLocked=true`; POST vraća baš 422 i ne
   kreira ništa.
3. `pending` i dva istovremena POST-a → jedna nit, jedan `thread_created` red, odgovori 201/200.
4. Deterministički close-vs-create: outcome UPDATE prvi drži claim row lock, create nastavlja posle
   commita → 422 i nula conversation redova.
5. Dijalog šalje `outcome=pending` i ne crta zatvorene fixture-e.
6. Composer za zatvoren MR nema `NAPRAVI +`; klik na poslati MR čip vodi na claim tab bez create
   potvrde.
7. Tab zatvorene reklamacije crta postojeću nit bez composera; bez niti ne crta dugme.
8. Send/edit/withdraw/pin/unpin/react/unreact na zaključanoj niti vraćaju 422; read/download,
   mark-read i lični mute ostaju dozvoljeni.
9. Claim update i lokalno/udaljeno brisanje poništavaju pravi `(kind, claimId)` lookup, dok obična
   poruka iz drugog razgovora ne refetchuje sve zatvorene niti.
10. 422 nikada ne prikazuje success toast niti navigira na Opšti kanal.
11. Uspeh prvo refetchuje aktivnu listu: aktivna nit se tek onda otvara; nit zatvorena neposredno
    posle 201 vodi na read-only claim tab; u međuvremenu obrisana nit daje poruku, nikad fallback.

### Kanali

1. Create sa dva korisnika → tvorac + oba korisnika su članovi, postoji jedan `channel_created` red
   i svi vide kanal posle jednog signala.
2. Nevažeći/client/inactive id → 422 i kanal ne postoji.
3. Tvorac/admin dobijaju `canManage=true`; običan član false i nema add/remove kontrole.
4. Običan član ne može HTTP-om dodati ili skloniti drugoga.
5. Later-add sa mešavinom validnih i nevažećih id-jeva rollbackuje ceo batch.
6. Create/rename/roster/delete šalju dokumentovan opaque token, a
   conversations/members/people/management cache se ponište bez refetcha na običnu poruku.
7. Tvorac briše svoj kanal; drugi tvorac ne; admin briše kanal u kom nije član.
8. Tvorac posle napuštanja i dalje vidi metadata management za svoj kanal, ali ne može da čita
   messages/attachments; admin ima isto pravilo za sve kanale.
9. Legacy kanal sa nula članova i istorijom nije u adminovoj običnoj listi i vraća 404 za sadržaj,
   ali postoji u management listi; eksplicitni self-add ga tek tada otvara.
10. Departed creator/admin preimenuje kroz 204 bez conversation projekcije i bez curenja sadržaja.
11. Opšti kanal ostaje nepromenljiv i neobrisiv.
12. Kontrolisana send-vs-delete utrka na dve DB konekcije ostavlja nula notification redova i nula
    fajlova, vraća 404 novom sendu posle delete-a i ostavlja jedan audit trag sa tačnim COUNT-om.

Završna provera obuhvata fokusirane API/frontend/shared testove, lint, typecheck, production build,
DB integracije, `git diff --check` i nezavisni pregled diff-a.

---

## 10. Van obima

- transfer vlasništva kanala;
- automatsko arhiviranje ili brisanje praznog kanala;
- direktne privatne poruke;
- admin pristup tekstu privatnog kanala bez članstva;
- novi chat RBAC paket;
- push hardening dogovoren u odvojenom obimu.
