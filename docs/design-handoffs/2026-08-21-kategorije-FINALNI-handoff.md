# KATEGORIJE + DETALJ — FINALNI handoff (sve na jednom mestu, poslednja verzija)

**Za:** Claude Code · **App:** `internal-web` · **Datum:** 21.08.2026
**Ovaj dokument je KONAČAN i ima prvenstvo** nad svim ranijim kategorije-dokumentima gde se razlikuju. Uz njega ide:
- `kategorije-prototip.dc.html` — klikabilan prototip (1440×900), **sada sa radnim tabovima detalja** (uđi u reklamaciju → klikći Pregled/Nalazi/Prilozi/Izveštaj). Boje/razmaci/veličine se ČITAJU iz njega.
- `2026-08-21-kategorije-KOMPLETNA-specifikacija.md` — piksel vrednosti (tokeni, širine kolona, fontovi). Važi i dalje, OSIM §6 (detalj) koji ovaj dokument zamenjuje.

> Princip: funkcionalnost, polja, mutacije, permisije i i18n iz POSTOJEĆEG KODA pobeđuju prototip. Izgled i raspored iz prototipa pobeđuju trenutno stanje aplikacije. Gde ne možeš da pomiriš — pitaj, ne improvizuj.

---

## 1. PRVO ISPRAVI OVO — greške iz poslednjeg builda (viđeno na screenshotovima)

1. **Tabovi na detalju su dekoracija.** URL ima `?tab=pregled`, a na strani su ISTOVREMENO naslagani Osnovni podaci + Nalazi editor + Inspection report + Kvarovi. Tabovi MORAJU stvarno da dele sadržaj (raspodela u §5). `?tab=` param već postoji — veži prikaz za njega.
2. **Dugmad lebdi u praznoj traci** ispod naslova. Sve akcije idu U NASLOVNI RED, desno: „✏ IZMENI PODATKE" outline · „✓ PRIHVATI" zeleno · „ODBIJ" crveni outline. Značka „OBJAVLJENO" NIJE dugme — ide u karticu „Klijent vidi" (i u header Izveštaj taba).
3. **Sadržaj udavljen u prazninama** — uska centrirana kolona, ogromne margine. Telo detalja: `max-width 1360px`, uz levu ivicu sadržajnog prostora (padding 24–28px), grid `1fr 340px, gap 16px`.
4. **Crveni pojas preko celog vrha ekrana.** U dizajnu postoji samo suptilan radijalni krug GORE-DESNO: `radial-gradient(circle, rgba(237,28,36,.16), transparent 65%)`, ~420px, iza sadržaja, `pointer-events:none`. Ukloni pojas.
5. **„Kvarovi" kartica ogoljena** („1 —"). Red = mono broj + opis (prazan → „—" italic) + pill krivice desno (amber RADNIK / ljubičasta ODELJENJE / ista šema SPOLJNA FIRMA).
6. **„Prilozi" kartica sa jednim „+" i morem praznine.** Grid 3 kolone malih kvadrata (`aspect-ratio 4/3`, radius 8), kartica se skuplja uz sadržaj.

## 2. MENI — šta, zašto, kako povezati

**Šta:** stavka 03 „Reklamacije" postaje grupa koja se širi (caret ▾/▸): prva pod-stavka „Sve reklamacije", pa SVE aktivne kategorije iz šifarnika (i prazne), redom iz admina. Uz grupu amber badge = ukupno nerešenih; uz svaku kategoriju njen broj (amber >0, `opacity .45` kad je 0). Stavka „Servis" se preimenuje u „Prijem vozila" (samo labela). Sužen sidebar: ikonica sa amber tačkom → flyout sa istom listom.

**Zašto:** operater radi po vrsti posla — meni je direktan ulaz u svoju kategoriju, a broj mu kaže gde ima posla. Prazne kategorije stoje da bi se videlo da postoje i da je nula stvarna nula.

**Povezivanje:** kategorije = postojeći šifarnik (treba `sortOrder` + `active` u odgovoru ako fale). Brojevi = novo polje u postojećem summary/dashboard query-ju: `{categoryId, pendingCount}[]` + ukupno; invalidira se posle mutacija reklamacija. Stanje grupe (otvoreno/zatvoreno) u localStorage. Aktivna pod-stavka prati rutu (i na detalju/čarobnjaku otvorenom iz nje). **Ništa hardkodovano** — 3 ili 7 kategorija mora da radi.

## 3. LISTA — jedan ekran, dva režima

**Šta:** ISTA komponenta za `/reklamacije` (sve) i `/reklamacije/kategorija/$id`. Režim kategorije: eyebrow `KATEGORIJA` + H1 ime + „Nerešeno: N · Ukupno: M"; u filterima NEMA selecta kategorije — umesto njega dashed čip `KATEGORIJA = {IME} ✕` (✕ → `/reklamacije`, ostali filteri se zadržavaju). Režim „sve": eyebrow `SVE VRSTE POSLA`, kolona KATEGORIJA u tabeli (čip; ugašena sa † i dashed ivicom), select Kategorija u filterima. JEDNO primarno dugme „+ NOVA REKLAMACIJA".

**Zašto dva režima a ne dve strane:** isti filteri/kolone/sortiranje — razlikuje se samo kontekst; čip umesto selecta zato što je u sekciji kategorije promena kategorije = navigacija, ne filter.

**Povezivanje:** postojeći claims endpoint već filtrira po kategoriji — ruta samo prosleđuje `categoryId` u postojeći search schema. Segmented VRSTA (Sve/EMOTIVE/DOMAĆE) mapira na postojeći `kind` param. **Svi postojeći filteri, kolone i radnje (oko+kanta) OSTAJU** — prototip je minimum, ne maksimum. Prazna stanja: prazna kategorija (poruka + dugme) i filteri bez pogotka (+ „PONIŠTI FILTERE").

## 4. ČAROBNJAK — 4 koraka, obe vrste

**Šta:** VRSTA → PODACI → KVAROVI → PREGLED (stepper: aktivan crven krug / završen zelena tinta ✓ / budući outline; zelene spojnice). Korak 1 = dve velike kartice EMOTIVE/DOMAĆA (klik bira i odmah vodi dalje). U zaglavlju čip `KATEGORIJA: {IME} ▾` — meni svih aktivnih kategorija, promena važi ODMAH. Dugmad: NAZAD outline · DALJE primarno (svetla ispuna, NE crveno) · „✓ SAČUVAJ" ZELENO na kraju. Posle čuvanja → lista kategorije iz koje je unos krenuo + toast.

**Zašto:** jedno dugme „+ Nova" umesto dva (odluka vlasnika); vrsta je prvi izbor jer menja polja i tok; kategorija je čip a ne zaključano polje jer serviser ume da pogreši pa mora lako da promeni.

**Povezivanje:** proširuje POSTOJEĆI EMOTIVE 3-koračni wizard novim prvim korakom; DOMAĆA se spaja u isti tok — dodaje svoja polja (broj računa, iznos fakture/delova/rada) u korak PODACI. Stara DOMAĆA duga forma se briše TEK kad novi tok prođe testove. Obavezna polja po **stvarnoj šemi validacije iz koda** (crvena zvezdica u labeli), ne po prototipu. Kvar-kartice (mono „KVAR 1", segmenti krivice, dashed „+ Dodaj kvar") već postoje — samo primaju i DOMAĆU.

**Polja kategorije (dashed grupa u koraku PODACI):** config-driven po `categoryId` — kategorija prikazuje SAMO svoja polja; bez polja → grupa se NE renderuje; promena kategorije čipom odmah zamenjuje grupu (confirm ako su stara polja popunjena — vrednosti se odbacuju). ⚠ Polja u prototipu (Obrađeni deo, Mera obrade, Obim remonta, Stanje bloka, Kataloški broj, Dobavljač) su **ILUSTRATIVNI PRIMERI** — šema ne postoji u bazi. Napravi mehanizam (config + render), config ostavi PRAZAN dok vlasnik ne odobri stvarna polja po kategoriji. Ne izmišljaj polja.

## 5. DETALJ — 4 taba, svaki nosi svoj deo radnog toka

Logika: **Pregled = stanje (čita se) → Nalazi = interna kuhinja (piše se) → Izveštaj = šta klijent dobija (piše se + objavljuje) → Prilozi = dokazi.** Zato tabovi, a ne jedna beskonačna strana sa tri zelena SAČUVAJ.

**Naslovni blok (iznad tabova, uvek vidljiv):** „← NAZAD NA LISTU" · red: MR broj mono 25px + kind pill + čip kategorije + ishod pill + (desno) IZMENI PODATKE outline / ✓ PRIHVATI zeleno / ODBIJ crveni outline · mono podnaslov (br. rekl. · partner · primljeno · zadužen). Ugašena kategorija: dashed značka `KATEGORIJA UGAŠENA MM/YY` uz čip.

**Tab PREGLED** (sve read-only): grid `1fr 340px`:
- Levo: **Osnovni podaci** (4-kolonski grid, mono labele 8.5px, vrednosti 13px w600, kodovi/datumi mono, prazno „—") · **Polja kategorije** (dashed kartica — tri stanja: popunjeno / „Nije popunjeno" italic / `UKINUTO MM/YY` značka sa sačuvanom prigušenom vrednošću; bez config polja → kartica se NE renderuje) · **Kvarovi** (read-only redovi sa pillovima krivice).
- Desno: **Klijent vidi** (samo EMOTIVE; timeline tačke Primljeno zelena / U obradi plava / Ishod prazan krug; datumi mono; značka OBJAVLJENO/NIJE OBJAVLJENO; dugme „OBJAVI ISHOD KLIJENTU" outline) · **Prilozi mini** (prvih 6 + „Svi →" koji prebacuje na tab Prilozi).

**Tab NALAZI (N)** — postojeći editor nalaza, preobučen: opis ispod naslova „Interni nalazi — klijent ih ne vidi."; kartica po nalazu (crveni mono eyebrow „NALAZ 1" + „🗑 UKLONI" desno; TIP NALAZA input 42px; OPIS textarea); „+ DODAJ NALAZ" dashed; JEDNO zeleno „✓ SAČUVAJ" desno u futeru. Broj nalaza u labeli taba (mono 10px). Prazno: italic „Još nema nalaza — dodaj prvi."

**Tab IZVEŠTAJ** — postojeći TipTap/EN izveštaj: header kartice = naslov „Izveštaj o pregledu (EN)" + značka NIJE OBJAVLJENO (siva) / OBJAVLJENO (zelena tinta) + „OBJAVI KLIJENTU" outline (postojeća mutacija); opis „EN — vidljivo klijentu na portalu. Piše se na osnovu internih nalaza."; editor; jedno „✓ SAČUVAJ". Prazno stanje sa hintom ka tabu Nalazi.

**Tab PRILOZI (N)** — puna galerija (grid 6 kolona, mono UKUPNO u headeru, dashed „+" za upload — postojeći upload sistem).

**Povezivanje:** `?tab=` param upravlja prikazom; brojevi u labelama iz postojećih podataka; sve mutacije (nalazi CRUD, izveštaj save, objavi klijentu, prihvati/odbij) su POSTOJEĆE — menja se samo gde stoje. Sekcije koje kod ima a prototip ne (npr. iznosi domaće) rasporedi po istoj logici: read-only činjenice → Pregled; editori → svoj tab; pitaj ako nije očigledno.

## 6. PROMENA KATEGORIJE POSLE ČUVANJA (već definisano, ne zaboravi)

Na detalju: „⇄ PROMENI" uz čip kategorije → dijalog (novi izbor + obavezan razlog) → posle promene: polja stare kategorije se čuvaju kao UKINUTO-stil istorija, a ako nova kategorija ima obavezna polja → **amber traka „⚠ DOPUNI PODATKE — kategorija promenjena"** na vrhu Pregleda dok se ne popune + sistemski zapis u audit. Detalji u `2026-08-21-promena-kategorije-handoff.md` — i dalje važi ceo.

## 7. PRAVILA KOJA SE NE KRŠE

- Crvena `#ed1c24` = brend/akcenat/destruktivni OUTLINE. Nijedno dugme puna crvena ispuna; Sačuvaj/Prihvati ZELENO `#1fa971`; primarno = svetla ispuna `--btn`.
- Kind boje svuda: EMOTIVE plava `#2e90fa` / DOMAĆA ljubičasta `#a78bfa` (jedna KindPill komponenta).
- Mono (JetBrains Mono) za sve tehničko: MR brojevi, šifre, datumi, brojevi, eyebrow/labele, značke, brojači tabova.
- Kartica: `--surface` + `1px solid --border`, radius 14px, BEZ senke (dashed ivica samo za „Polja kategorije" — namerno drugačija).
- i18n kroz Paraglide, SR+EN paritet, EN ~35% duži; „EMOTIVE" se ne prevodi.
- fadeUp ulazi, hover lift na dugmadima, crveni fokus ring na svim poljima; `prefers-reduced-motion` isključenje.
- Sve novo iza postojećih permisija; ništa se ne briše zato što ga nema u prototipu.

## 8. REDOSLED RADA (svaki korak: build + typecheck + test zeleni)

1. §1 ispravke (tabovi rade, naslovni red, širina, glow, kvarovi, prilozi) — NAJPRE, to je viđeno i ne valja.
2. Detalj tabovi finalno (§5) sa preraspodelom postojećih editora.
3. Meni (§2) + API za brojeve.
4. Lista dva režima (§3).
5. Čarobnjak (§4) — vrsta korak + DOMAĆA spajanje + polja kategorije mehanizam (prazan config).
6. Promena kategorije posle čuvanja (§6).
7. Prazna stanja + poliranje.

## 9. HANDBACK

Posle koraka 1–2 ODMAH pošalji screenshotove ista tri taba istog naloga (Pregled/Nalazi/Izveštaj) pre nego što nastaviš — da ne ponovimo ovaj krug. Na kraju: meni pun + sužen flyout · lista oba režima · sva 4 koraka čarobnjaka (obe vrste) · detalj sva 4 taba · promena kategorije (dijalog + amber traka) · oba prazna stanja. Svaku odluku donetu van ovog dokumenta navedi eksplicitno. Commit tek posle odobrenja.
