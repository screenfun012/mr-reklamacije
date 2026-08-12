# Prijem — dokument kao jedan zapečaćen fajl (deo 2, dizajn)

**Datum:** 2026-08-13 · **Grana:** `feat/vehicle-intake` · **Osnova:** `50ac520`
**Status:** odobreno u razgovoru (Nikola, 12–13.08.), migracija odobrena, kod nije počet

---

## 0. Odakle ovo dolazi

Nikola, 12.08.:

> „Taj pdf dokument nam treba sa svime iz prvog dela — znači svi podaci koji su uneti od strane
> prijema moraju da budu na tom dokumentu, tačnije sve što je uneto do tog momenta… šema, sve,
> zatečeno stanje, osnovni podaci, sve nam to treba u tom dokumentu. Kako će on da se prikaže i kako
> će da bude triger da se mail pošalje klijentu mene ne zanima iskreno — smisli najelegantnije
> rešenje za ovaj problem… mail se šalje klijentu u pozadini, stvarno me ne zanima kada."

I, o načinu rada:

> „Hoću moderno savremeno rešenje, kako se danas radi… ne želim nikakvo krpljenje, nikakvo
> izmišljanje, hoću čist i uredan kod… ne želim da se vratim za mesec dana i da te pitam a što je ovo
> ovakvo a što ovo ne radi."

---

## 1. Šta je istraživanje pokazalo, i kako je promenilo predlog

Sedam paralelnih pregleda repozitorijuma i prakse (2025–2026). Tri nalaza su promenila dizajn:

**① Papir već nosi sve iz prva tri koraka.** Polje po polje: model lista čita **26 polja** naloga.
Nedostaju tačno dva — `ownerEmail` (namerno, i test to čuva: to je adresa za slanje, ne činjenica o
primopredaji) i **fotografije kao slike**, koje je Nikola sam sklonio 10.08. („to ne mora da stoji,
može da stoji koliko slika je slikano"). **Odluka 13.08.: fotografije se NE vraćaju** — PDF je isti
dokument kao papir u ruci.

**② „Isti dokument na ekranu, štampaču i u mejlu" se ne postiže crtanjem tri puta.** Ta tri
potrošača ne dele ugovor o iscrtavanju: ekran je u CSS pikselima pri zumu gledaoca, štampački
drajver primenjuje svoje skaliranje („fit to page" skuplja stranu sa marginom 0), a **interaktivni i
headless Chromium dokazano ne slažu se** oko dimenzija strane i oko toga da li uopšte dovlače
resurse iz `@page` pravila. Jedina formulacija koja stoji: **napravi JEDAN PDF jednom, i neka svi
gledaju taj isti fajl.**

**③ Postojeći PDF reklamacija ima živu grešku koja bi se prekopirala.** `claim-report-export-font.ts`
ugrađuje **samo latinični podskup** Figtree (`U+0000–00FF`), a `č ć ž š đ` žive u `latin-ext`
(`U+0100–02BA`). U kontejneru se onda crtaju u Liberation Sans — **drugo slovo, ne prazan kvadratić**,
zato nikad nije prijavljeno. Ekran ≠ PDF na tačno onim slovima od kojih je srpski dokument sastavljen.
⚠ **Prijavljeno, popravlja se odvojeno** (§8) — ali ovaj dokument mora od prvog dana da ugradi
**oba** podskupa, i za Figtree i za JetBrains Mono.

---

## 2. Odluke

| #  | Pitanje                                       | Odluka                                                                                                                                                                                                                                                                                          |
| -- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①  | Šta je „dokument"?                            | **Jedan PDF fajl, napravljen jednom, u trenutku potpisa.** Ne iscrtava se po potrošaču. Mejl kači taj fajl, kancelarija skida taj fajl, ponovna štampa gleda taj fajl.                                                                                                                            |
| ②  | Ko ga crta?                                   | **Server, iz ISTE komponente koju crta i ekran.** List se seli u `packages/intake-document`; interna aplikacija ga crta React-om u pregledaču, API ga crta `renderToStaticMarkup`-om. Nije kopija — isti kod, dva ulaza iste biblioteke.                                                            |
| ③  | Kako se rešava CSS?                           | **Ugrađeni stilovi (`style={{}}`), bez Tailwinda u paketu.** Sve boje su već doslovni heksovi, sve mere doslovni pikseli — pretvaranje je preimenovanje, ne redizajn. Time nestaje cela klasa problema (Tailwind u paketu, `@source` staze, verzije), i **popravlja se `font-mono`**, koji danas van interne aplikacije tiho pada na drugi font. |
| ④  | Gde stoji fajl?                               | **U objektnom skladištu, a tri kolone na nalogu** pamte putanju, otisak i kad je mejl otišao. NE kao `attachments` red: intake fotografije se prepoznaju **isključivo** po `intake_order_id IS NOT NULL` (komentar u šemi to i kaže), a PDF u toj tabeli bi ušao u brojanje fotografija na **pet** mesta. |
| ⑤  | Čime se dokazuje da nije menjan?              | **SHA-256 otisak** uz fajl. Chromium PDF **nije bajt-determinističan** (datum nastanka i ID se menjaju po iscrtavanju), pa „isti bajtovi" ne može da znači „dva crtanja se poklapaju" — može da znači samo „ovo je onaj fajl". Repozitorijum već ima taj obrazac (`content_sha256` na prilozima).       |
| ⑥  | Kad se šalje?                                 | **Odmah po potpisu, u pozadini, i nikad ne blokira.** Isti obrazac koji već postoji za EMOTIVE ishod: `void this.…().catch(log)` posle upisa, audita i SSE signala.                                                                                                                                |
| ⑦  | Šta ako padne?                                | **Potpis ostaje.** Nalog pokaže da dokument nije napravljen ili da mejl nije otišao, i kancelarija pokrene ponovo. Bez reda čekanja i bez automatskog ponavljanja — u repozitorijumu ih nema nijedan, i ovaj posao nije mesto da se uvode.                                                          |
| ⑧  | Šta ako vlasnik nema mejl?                    | **Ništa se ne šalje**, dokument se svejedno napravi i sačuva. Nikolina rečenica, doslovno: „ako klijent nema mail onda ništa, ne šalje se nego samo dobije fizičku kopiju."                                                                                                                        |
| ⑨  | Fotografije u PDF-u?                          | **Ne** (Nikola, 13.08.). Ostaje broj, kao na papiru. Jedna strana je **noseća**: čim se dozvoli prelamanje, ulaze prelomi, ponavljanje zaglavlja i `break-inside` koji je u flex rasporedu dokazano nepouzdan.                                                                                     |
| ⑩  | Ponovno slanje?                               | **Dugme u kancelariji**, koje šalje **postojeći fajl** — nikad ga ne crta ponovo. Ponovno crtanje bi napravilo drugi fajl sa drugim otiskom za isti potpisani nalog.                                                                                                                              |

---

## 3. Model podataka

Tri kolone na `intake_orders`, migracija **`0043`** (generisana `drizzle-kit`-om, lanac od nule
dokazan pre primene):

| Kolona                   | Oblik           | Nosi                                                       |
| ------------------------ | --------------- | ---------------------------------------------------------- |
| `document_storage_path`  | `text` nullable | gde fajl stoji u skladištu; NULL = još nije napravljen      |
| `document_sha256`        | `text` nullable | otisak bajtova, dokaz da je to taj fajl                     |
| `document_emailed_at`    | `timestamptz` nullable | kad je mejl sa prilogom otišao; NULL = nije (ili nema mejla) |

Postojeći nalozi dobijaju tri prazna polja. Nijedan potpisan nalog se ne dira retroaktivno — stari
nalozi nemaju dokument i to je istina o njima, ne rupa.

⚠ **Ove tri kolone NISU na `FREE_AFTER_SIGNING`.** One se ne upisuju kroz `update` uopšte, nego kroz
sopstvenu servisnu putanju — pa zamrzavanje iz dela H ostaje netaknuto i ne treba mu izuzetak.

---

## 4. Paket `@mr/intake-document`

**Šta se seli:** `intake-print-sheet.tsx`, `intake-print-condition.tsx`, `intake-print-damages.tsx`,
`intake-print-data.ts`, `intake-print-styles.ts`, plus ono što oni čitaju — siluete, katalog
ček-liste (razrešavanje imena), natpisi, i `SIGNATURE_VIEW_BOX`.

**Šta OSTAJE u internoj aplikaciji:** ceo pregled — `intake-print-dialog.tsx`, `intake-print-scale.ts`,
`intake-print-zoom.ts`, `use-intake-print-zoom.ts`, `intake-print.css`. To je oprema oko dokumenta
(zum, skrol, `window.print()`, izolacija od ostatka strane), nije dokument.

**Jedina prepreka i njeno rešenje:** ceo stablo dokumenta uvozi samo prenosive module (`@mr/i18n`,
`@mr/shared`, `@mr/ui`, `react`) — osim **jedne** veze: `buildIntakePrintModel` → `formatIntakeReceivedAtLong`
→ `internalIntlLocale`, funkcija od tri reda koja mapira `sr`→`sr-Latn-RS`, `en`→`en-GB`. Ona se seli
u paket sa dokumentom. Interna aplikacija je onda uvozi otuda, umesto obrnuto.

### 4.1 Stilovi

Sve što danas stoji kao Tailwind klasa u ta tri fajla postaje **ugrađeni stil na elementu**. To je
mehanička zamena, jer su vrednosti već doslovne (`#17171a`, `text-[11.5px]`, `w-[794px]`,
`grid-cols-[186px_1fr]`). Pet deljenih klasa-konstanti (`PRINT_BAND`, `PRINT_EYEBROW`…) postaju pet
objekata stila.

⚠ **Dokazuje se merenjem, ne rečju:** pre i posle seljenja list se iscrta u pregledaču i slike se
uporede piksel po piksel. Ako se razlikuju, seljenje nije gotovo.

⚠ **Font se NE nasleđuje više.** Danas list uzima Figtree od tela strane interne aplikacije, a
`font-mono` iz njenog `globals.css`. U paketu oba moraju biti imenovana eksplicitno, a **ugrađuje ih
potrošač**: interna aplikacija ih već ima, a API ih ubacuje u omotač (§5).

---

## 5. Kako server pravi PDF

Nova usluga u API-ju, po uzoru na postojeći izvoz izveštaja, ali **bez svog Chromiuma** — koristi
onaj koji već postoji (`ClaimReportPdfRenderer`: jedan deljeni pregledač, najviše 2 iscrtavanja
odjednom, gasi se posle 10 minuta mirovanja jer je držao ~600 MB).

1. `renderToStaticMarkup(<IntakePrintSheet …/>)` → HTML tela.
2. Omotač oko njega ubacuje: `@page { size: A4 portrait; margin: 0 }`, `@font-face` za **Figtree i
   JetBrains Mono, oba podskupa (`latin` + `latin-ext`)**, kao `data:` URI.
3. Chromium: `printBackground: true` (**inače crvena traka izađe bela** — podrazumevano je `false`) i
   `preferCSSPageSize: true`, da veličina strane ima **jedan** izvor istine, a ne dva.
4. Rezultat je `Buffer`.

⚠ Ništa se ne dovlači preko mreže tokom iscrtavanja: fontovi, logo i potpisi su `data:` URI ili SVG
putanje. Headless Chromium **odbija** da dovuče resurse iz `@page` pravila, i to ćutke.

⚠ **`renderToStaticMarkup` traži `react-dom` u API-ju.** To je nova zavisnost i traži Nikolinu reč
(CLAUDE.md §5) — ali je to standardan način da server iscrta React dokument, i alternativa (drugi
opis dokumenta) je tačno ono što ovaj spec izbegava.

---

## 6. Kad i kako se sve to dešava

U `sign()`, **posle** upisa, audita i SSE signala — dakle tek kad je potpis već činjenica:

```
void this.produceAndSendDocument(id).catch((error) => logger.error(…))
```

`produceAndSendDocument`:

1. učita nalog + katalog ček-liste (isti DISPLAY čitanje koje pregled koristi, da ugašena stavka
   zadrži ime),
2. iscrta PDF,
3. upiše ga u skladište i zapamti putanju + SHA-256,
4. ako `ownerEmail` postoji **i** je mejl uopšte podešen: pošalje ga kao prilog i zapamti kad.

Svaki korak koji padne ostavlja prethodne — nalog sa dokumentom a bez mejla je tačan zapis stanja, ne
polovičan.

⚠ **`EmailPort` danas ume samo `{to, subject, html}` — nema priloge.** Dobija ih (`attachments`), a
`Resend` ih podržava. Test dvojnik snima šta je poslato, kao i danas.

---

## 7. Šta se mora dokazati

**Merenjem:**

- list pre i posle seljenja u paket — **piksel po piksel isto**
- PDF sa servera naspram odštampanog papira: ista strana, crvena traka crvena, srpska slova u Figtree
- najgori nalog i dalje jedna strana, oba potpisa na njoj

**Testovima** (svaki mora da padne kad se pokvari linija koju pokriva — mutacija, ne argument):

- potpis prolazi i kad iscrtavanje padne, i kad mejl padne
- bez `ownerEmail` se ne šalje ništa, a dokument se **svejedno** napravi
- otisak upisan u bazu je otisak sačuvanih bajtova
- ponovno slanje šalje **postojeći** fajl (skladište se čita, ne crta se ponovo)
- prilog stigne do porta sa pravim imenom i tipom
- dokument se ne pravi za nepotpisan nalog

---

## 8. Prijavljeno, ostaje nedirnuto

- **Živa greška:** `claim-report-export-font.ts:13` ugrađuje samo `latin` podskup Figtree, pa srpska
  slova u PDF-u izveštaja o reklamaciji ispadaju u Liberation Sans. Svoj popravak, svoj test.
- `docs/25:337-340` još tvrdi da broj oštećenja stoji „i na štampi" uz fotografiju — to je prestalo
  da važi 10.08. kad su fotografije skinute sa lista.
- Naslovi USLUGE i MATERIJAL se štampaju i kad nemaju nijedan red ispod sebe.

---

## 9. Faze

| Faza    | Sadržaj                                                                          | Kraj                                        |
| ------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| **D-0** | migracija `0043` (tri kolone)                                                     | lanac od nule dokazan, gejt zelen, komit    |
| **D-1** | `packages/intake-document` — seljenje + ugrađeni stilovi; interna aplikacija ga koristi | **piksel po piksel dokazano**, gejt zelen, komit |
| **D-2** | iscrtavanje PDF-a na serveru (fontovi, oba podskupa, deljeni Chromium)            | PDF upoređen sa papirom, gejt zelen, komit  |
| **D-3** | skladište + otisak + tri kolone + preuzimanje dokumenta                           | gejt zelen, komit                           |
| **D-4** | prilog u `EmailPort` + slanje u pozadini na potpisu + ponovno slanje              | gejt zelen, komit                           |
| **D-5** | pun gejt, dokaz u pregledaču, push                                                | —                                           |

Pun gejt pre svakog komita.
