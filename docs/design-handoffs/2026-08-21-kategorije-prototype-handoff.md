# Reklamacije po kategorijama — Design handoff (uz radni prototip)

**Za:** Claude Code · **App:** `internal-web` · **Datum:** 21.08.2026
**Funkcionalni izvor istine:** `2026-08-21-reklamacije-kategorije-handoff.md` (problem §6, ekrani §7, podaci §8, §9 razilaženje polja, §10 čega nema)
**Vizuelni izvor istine:** `kategorije-prototip.dc.html` — klikabilan prototip 1440×900. Boje, razmaci i veličine se čitaju iz njega, ne procenjuju.

> Pravilo prvenstva: funkciju definiše funkcionalni dokument i postojeći kod, izgled i ponašanje prototip. Gde se razlikuju — **pitaj, ne improvizuj**. Sve postojeće rute, upiti, mutacije, permisije i i18n ostaju; ovo je reorganizacija navigacije + ulaza u unos, ne novi modul.

---

## 0. Odluke vlasnika (donete 21.08, ne preispituju se)

1. **Meni = varijanta „stablo":** „Reklamacije" je grupa koja se širi; kategorije su pod-stavke. Kliknuta kategorija = lista te kategorije.
2. **Broj uz kategoriju = NEREŠENO** (ishod „Na čekanju"). Podatak danas ne postoji na API-ju — **dodaje se** (vidi §5).
3. **U meniju stoje SVE aktivne kategorije, i prazne.** Ugašene se ne prikazuju u meniju; stare reklamacije ih i dalje nose (vidi §4 detalj).
4. **„Servis" se preimenuje u „Prijem vozila"** — samo labela stavke menija, ruta ostaje.
5. **Jedno „+ Nova reklamacija" dugme** (umesto dva). Vrsta EMOTIVE/DOMAĆA je **prvi korak čarobnjaka**.
6. **Kategorija u formi se može promeniti u hodu** — vidljiv čip u zaglavlju čarobnjaka sa ▾ menijem, ne zaključana.
7. **Obe vrste kroz isti čarobnjak** (Vrsta → Podaci → Kvarovi → Pregled). DOMAĆA ne dobija posebnu formu — dodaje svoja polja (broj računa, iznosi) u korak Podaci. Postojeći EMOTIVE 3-koračni wizard se proširuje korakom Vrsta; stara DOMAĆA duga forma se penzioniše.

## 1. Meni (sidebar)

- Redosled: 01 Početna · 02 Pristiglo · 03 **Reklamacije** (grupa) · 04 Prijem vozila · 05 Statistika.
- Stavka „Reklamacije": badge ukupno nerešenih (amber pill `rgba(234,179,8,.13)` + `--mri-amb` tekst, mono 10px) + caret ▾/▸. Klik na stavku širi/skuplja grupu; **stanje grupe se pamti** (localStorage). Podrazumevano otvorena.
- Pod-stavke (uvučene, `border-left 1px --mri-border` vodeća linija, visina 32px, 12.5px): **„Sve reklamacije"** prva, pa kategorije iz šifarnika **redom iz admina** (ne abecedno). Broj desno mono: amber kad > 0, prigušen (`opacity .45`) kad je 0.
- Aktivna pod-stavka: tinta `rgba(237,28,36,.11)` + `inset 2px 0 0 var(--mri-red)` + beli tekst w700. Aktivna je i kad si na detalju/čarobnjaku otvorenom iz te kategorije.
- **Suženi (icon-only) meni:** ikonica reklamacija sa amber tačkom; **klik otvara flyout** (196px, raised bg, border2, senka `0 18px 44px rgba(0,0,0,.55)`) sa istom listom. Esc/klik van zatvara.
- Kategorije se čitaju iz šifarnika — **ništa hardkodovano**; 3 ili 7 kategorija mora da radi (meni skroluje ako zatreba).

## 2. Lista — jedan ekran, dva režima (NE dve komponente)

Ruta predlog: `/reklamacije` (sve) i `/reklamacije/kategorija/$id` — ista list komponenta, `categoryId` iz rute.

**Režim kategorije:** eyebrow `KATEGORIJA` (crveni mono) · H1 ime kategorije · podnaslov „Nerešeno: N · Ukupno: M". U filter kartici **nema selecta kategorije** — umesto njega dashed čip `KATEGORIJA = MAŠINSKA OBRADA ✕`; klik na ✕ vodi na `/reklamacije` (zadržava ostale filtere). To je odgovor na §7B pitanje: promena kategorije = izlazak iz sekcije, eksplicitno.

**Režim „sve":** eyebrow `SVE VRSTE POSLA` · H1 „Sve reklamacije" · kolona KATEGORIJA u tabeli (čip: `--mri-inbg` bg + border2, mono 10px) · select Kategorija u filterima (običan filter, ne navigacija).

Zajedničko: filter kartica (pretraga „MR broj, partner, motor…", segmented VRSTA Sve/EMOTIVE/DOMAĆA, Ishod, Proizvođač, datumi — **svi postojeći filteri i kolone iz koda ostaju**, prototip je minimum), tabela sa postojećim radnjama (oko+kanta ostaju — prototipski → je samo placeholder), paginacija. Jedno primarno dugme „+ NOVA REKLAMACIJA" (svetla ispuna `--mri-btn`).

**Ugašena kategorija na starom zapisu:** čip sa `†` i dashed ivicom, prigušen tekst. U filteru kategorija ugašene se listaju u posebnoj grupi „Ugašene" (samo ako imaju zapise).

## 3. Čarobnjak — 4 koraka

Stepper: krug 26px — aktivan crven/beo · završen zelena tinta + ✓ · budući outline; spojnice zelene kad je korak završen. Mono labele VRSTA · PODACI · KVAROVI · PREGLED.

- **Zaglavlje:** „← Nazad" (izlaz uz potvrdu ako ima unetog), naslov koraka, desno **čip kategorije** `KATEGORIJA: MAŠINSKA OBRADA ▾` (inbg + border2, mono) — klik otvara meni svih aktivnih kategorija; promena važi odmah. Ulaz sa opšte liste: isti čarobnjak, čip počinje kao izbor (kategorija je obavezna pre čuvanja).
- **Korak VRSTA:** dve velike kartice — EMOTIVE (plavi pill, opis: partner iz sistema, portal Primljeno→U obradi→Ishod, nalaz na engleskom) i DOMAĆA (ljubičasti pill, opis: kupac kao tekst, bez portala, iznosi). Hover: lift + tint ivica u boji vrste. Klik = izbor + odmah korak 2.
- **Korak PODACI:** 2-kolonski grid, mono labele sa crvenom zvezdicom po **stvarnoj šemi validacije iz koda** (ne iz prototipa). DOMAĆA dodaje: broj računa, iznos fakture, iznos delova, iznos rada (+ ukupno računato). Ispod: **grupa „POLJA KATEGORIJE"** u dashed okviru — mesto iz §9. ⚠ Polje „Obrađeni deo" (Glava/Blok/Radilica) **danas ne postoji u bazi** — ugradi PRAZAN dashed kontejner koji se renderuje tek kad kategorija ima definisana polja (config-driven), a samo polje NE pravi dok vlasnik ne odobri šemu. Ne izmišljaj druga polja.
- **Korak KVAROVI:** postojeća kvar-kartica (mono „KVAR 1", krivica Radnik/Odeljenje/Spoljna firma kao segmenti, dashed „+ Dodaj kvar") — već postoji u EMOTIVE wizardu, samo prima i DOMAĆU.
- **Korak PREGLED:** key/value redovi sa linijama (labela mono 190px + vrednost; kodovi/datumi mono), plava info nota: „otvara se sa ishodom Na čekanju" + rečenica o portalu zavisno od vrste. Dugmad: NAZAD outline · DALJE primarno · ✓ SAČUVAJ zeleno solid (`#1fa971`).
- Posle čuvanja: **navigacija na listu kategorije** iz koje je unos krenuo + toast „Reklamacija MR NNNN/NN sačuvana — {kategorija}" (postojeći `showInternalToast`).

## 4. Detalj

- Naslovni red: `MR 7167/25` mono 25px · KindPill · **čip kategorije odmah tu** · OutcomePill; ispod mono podnaslov (br. rekl. · partner · datumi · zaduženi). Radnje: ✓ PRIHVATI zeleno / ODBIJ crveni outline (postojeće mutacije).
- **Nova kartica „Polja kategorije"** (dashed ivica — namerno drugačija od ostalih kartica): grid vrednosti sa tri stanja iz §9:
  1. popunjeno — normalna vrednost;
  2. **nije popunjeno** — italic `--mri-text2` „Nije popunjeno";
  3. **ukinuto** — mala dashed značka `UKINUTO MM/YY` uz labelu, vrednost sačuvana i prikazana prigušeno. **Nikad ne sakrivaj ukinuto polje sa vrednošću** — to je cela poenta §9.
  - Kategorija bez definisanih polja: kartica se **ne renderuje** (ne prazna kartica).
- Stara reklamacija sa ugašenom kategorijom: uz čip kategorije dashed značka `KATEGORIJA UGAŠENA MM/YY` — informativno, ne greška; sve ostalo normalno.
- Sve ostale sekcije detalja (nalaz, nalazi, prilozi, izveštaj, TipTap...) ostaju kakve jesu.

## 5. API / podaci (minimalne izmene — prijavi pre nego što ih praviš)

1. **Brojevi za meni:** endpoint ili proširenje postojećeg summary-ja: `{categoryId, pendingCount}[]` + ukupno. Kešira se uz postojeći dashboard query; osvežava na invalidaciju posle mutacija reklamacija.
2. **Kategorije:** postojeći šifarnik — treba `sortOrder` (redosled iz admina) i `active` flag u odgovoru ako ih već nema.
3. **Lista:** postojeći endpoint već filtrira po kategoriji — ruta samo prosleđuje `categoryId`.
4. **§9 polja kategorije:** NE praviti šemu sada. Samo UI mesta (dashed grupa u formi + kartica u detalju) iza config-a koji je trenutno prazan.

## 6. i18n

Novi ključevi kroz Paraglide, SR+EN paritet: naslovi režima liste, čip `KATEGORIJA =`, koraci čarobnjaka, kartice vrste (opisi), „Polja kategorije", stanja „Nije popunjeno"/„UKINUTO"/„KATEGORIJA UGAŠENA", prazna stanja („U ovoj kategoriji još nema reklamacija" + italic rečenica, „Nijedna reklamacija ne odgovara filterima" + „Poništi filtere"), toast. **Bez brojevne množine** („Nerešeno: 9", nikad „9 reklamacija"). EN ~35% duži — meni i čipovi to moraju podneti (ellipsis na imenu kategorije preko ~20 karaktera, pun naziv u title).

## 7. Redosled rada (svaki korak: build + typecheck + test zeleni, pa dalje)

1. Meni: grupa + pod-stavke + brojevi (API iz §5.1) + flyout u suženom stanju + „Prijem vozila" labela.
2. Lista: ruta kategorije + dva režima header/filtera + čip ugašene kategorije.
3. Čarobnjak: korak Vrsta + čip kategorije + spajanje DOMAĆE u wizard (najveći zalogaj — stara DOMAĆA forma se briše tek kad novi tok prođe testove).
4. Detalj: čip kategorije + kartica „Polja kategorije" (config-driven, zasad prazan config) + ugašena značka.
5. Prazna stanja + poliranje (fadeUp ulazi, hover stanja po prototipu).

## 8. Handback

Screenshotovi: meni pun + sužen sa flyout-om · lista kategorije + sve reklamacije · sva 4 koraka čarobnjaka (obe vrste) · detalj sa poljima kategorije · detalj sa ugašenom kategorijom · oba prazna stanja — dark (light po postojećim tokenima, bez posebnog dizajna). Odluke koje doneseš van ovog dokumenta — navedi ih eksplicitno. Commit tek posle odobrenja.
