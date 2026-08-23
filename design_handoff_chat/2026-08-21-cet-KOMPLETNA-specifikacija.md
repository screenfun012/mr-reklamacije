# Čet („Razgovori") — KOMPLETNA specifikacija do detalja

**Za:** Claude Code · **App:** `internal-web` · **Datum:** 21.08.2026
**Vizuelni izvor istine:** `cet-prototip.dc.html` (klikabilan, 1440×900). Odluke vlasnika: `cet-odluke.md`. Ovaj dokument piše svaki font, boju, veličinu i ponašanje — **ako nešto ovde nije opisano, čitaj iz prototipa; ako ne može da se pomiri sa kodom — pitaj, ne improvizuj.**

> Tokeni: iste vrednosti kao interna app (`--mri-*`). Gde postoji token — koristi token; nove vrednosti dodaj u `--mri-*` blok. Fontovi Figtree (UI) + JetBrains Mono (sve tehničko: MR brojevi, vremena, eyebrow labele, brojači, značke).

---

## 0. Odluke vlasnika (ne preispituju se)

1. Učesnici: **SAMO interni tim** — klijenti sa portala nikad ne vide čet.
2. Struktura: **Opšti kanal** + **kanali po temi/timu** (tim ih pravi sam) + **nit po reklamaciji** (1 reklamacija = najviše 1 nit).
3. Nit nastaje na TRI načina: iz poruke sa MR brojem · direktno „+" u listi (izbor reklamacije) · iz detalja reklamacije (tab „Razgovor" / dugme „Podeli u razgovor").
4. **MR broj u bilo kom tekstu postaje link** koji vodi u nit te reklamacije.
5. @pomen → obaveštenje pomenutom (zvono + glass popup); **sve nove poruke** → zvono + popup (osim mute/DND).
6. Prilozi: slike (galerija) + kamera direktno (tablet) + dokumenti (PDF, Excel). BEZ glasovnih poruka.
7. Mogućnosti: citat-odgovor · izmena/brisanje svoje poruke · viđeno · pretraga poruka · pin · reakcije ✓ · sistemske poruke u niti · podeljena kartica reklamacije · „NOVO" separator · mute po niti + DND · brzi odgovori · link na poruku. **ODBIJENO:** „kuca…" indikator i online tačka — ne praviti.
8. Isti razgovor niti = tab „Razgovor" u detalju reklamacije (jedan izvor poruka, dva mesta prikaza).

## 1. RASPORED EKRANA (stavka menija „Razgovori")

Tri kolone unutar postojećeg shella (sidebar 236px + topbar 58px ostaju netaknuti; stavka „Razgovori" u meniju nosi amber badge zbira nepročitanih):

| Kolona          | Širina                                                   | Sadržaj                              |
| --------------- | -------------------------------------------------------- | ------------------------------------ |
| Lista razgovora | **252px**, `--surface`, desna ivica `--border`           | header + pretraga + kanali + niti    |
| Tok poruka      | flex 1, `--bg`                                           | header razgovora + poruke + composer |
| Kontekst panel  | **250px**, `--surface`, leva ivica — SAMO u niti, toggle | kartica reklamacije + pin + prilozi  |

## 2. LISTA RAZGOVORA (levo, 252px)

- **Header** (padding `14px 12px 10px`): eyebrow „RAZGOVORI" mono `700 10px tracking .22em --red`; desno **DND prekidač**: mono `700 8.5px tracking .12em`, padding `4px 9px`, radius 7px — isključen: `--text2` + `--border2` ivica; uključen: `rgba(237,28,36,.13)` bg + `--redh` tekst + crvena ivica `.5`. Toast na promenu („Ne uznemiravaj uključen — popup pauziran").
- **Pretraga poruka:** input 34px radius 8, `--inbg` + `--border2`, `12px`, placeholder „Pretraga poruka…", crveni fokus ring. Pretražuje SVE poruke (kanali + niti), rezultat vodi na tačnu poruku (deep-link, §8).
- **Sekcija KANALI:** naslov mono `600 8.5px tracking .18em --text2` + desno **„+" dugme 20px** (radius 6, `--border2` ivica, hover belo) → dijalog „Novi kanal" (§9).
  - Red kanala: visina 36px, padding `0 10px`, radius 9px, `13px`; prefiks `#` mono `--text2`; aktivan: `rgba(237,28,36,.11)` + `inset 2px 0 0 var(--red)` + w700; neaktivan `--text2` w600, hover `--rowhv`. „Opšti kanal" uvek prvi i ne može se obrisati.
- **Sekcija NITI REKLAMACIJA:** naslov + **„+"** → dijalog „Nova nit" (§9).
  - Red niti: visina 40px, padding `0 10px`, radius 9px: **kind tačka 7px** (EMOTIVE `#2e90fa` / DOMAĆA `#a78bfa`) · MR broj mono `600 11.5px` beo · ispod partner/motor `10.5px --text2` ellipsis · desno **amber badge nepročitanih** (mono `600 9.5px`, `rgba(234,179,8,.13)`, padding `2px 7px`, radius 20) ILI **MUTE značka** (mono `700 7.5px`, `--border2` ivica, radius 5, `opacity .7`). Aktivna nit: crvena tinta + inset kao kanal. Utišana neaktivna: `opacity .65`.
  - Sortiranje: poslednja aktivnost gore; niti sa nepročitanim iznad pročitanih.
- **Futer liste** (gornja ivica, padding `11px 12px`): italic `10.5px --text2` objašnjenje kako nit nastaje (tekst iz prototipa).

## 3. HEADER RAZGOVORA (52px, `--surface`, donja ivica)

- **Kanal:** `# {ime}` — `#` mono `--text2`, ime `14px w800`; desno broj članova mono `500 10px --text2` („9 ČLANOVA").
- **Nit:** MR broj mono `700 13.5px` + kind pill (mono `700 9px tracking .08em`, padding `3px 8px`, radius 20, tinta `.13`) + „· nit reklamacije" `10.5px --text2`.
- Desno uvek: **PIN dugme** — mono `600 9px tracking .1em`, `--inbg` + `--border2`, padding `5px 10px`, radius 7, ikonica pina 11px, „PIN · N" → otvara listu prikačenih.
- Samo u niti: **mute zvonce** 30px (radius 8; utišano: amber tinta `.13` + amber ikonica + amber ivica `.5`; title objašnjava) i **ⓘ toggle** kontekst panela 30px (uključen: crvena tinta `.13` + crvena ivica `.5`).

## 4. TOK PORUKA (padding `16px 16px 10px`, gap 14px, auto-scroll na dno)

- **Info traka niti** (prva u toku): `11.5px --text2`, `--inbg` bg + `1px dashed --border2`, radius 9 — „Nit je vezana za reklamaciju — iste poruke, prilozi i sistemski događaji se vide i u detalju reklamacije, tab „Razgovor"."
- **Poruka:** avatar 32px krug (inicijali `11px w800`; boje po korisniku iz palete: crvena ispuna/plava tinta `.18`/ljubičasta/zelena) + kolona:
  - Red imena: ime `13px w800` · vreme mono `500 9.5px --text2` · [„izmenjeno" italic mono `9px`] · **link-ikonica 11px** (`opacity .5`, hover 1) → kopira deep-link na poruku + toast.
  - **Citat** (odgovor): levi border `2px --border2`, `--inbg` bg, radius `0 8px 8px 0`, padding `7px 10px`; autor mono `9.5px`, tekst `11.5px --text2` (skraćen).
  - **Tekst:** `13px lh 1.55`; **MR broj** = čip-link: mono `600 11.5px`, `rgba(46,144,250,.13)` bg + `#2e90fa`, padding `2px 7px`, radius 6, klik → nit; **@pomen**: w700, `rgba(237,28,36,.1)` bg + `--redh`, isti oblik. Regex render, `white-space:nowrap` na čipovima.
  - **Slike:** red sličica 104×74px radius 9, `--inbg` + `--border2`, hover svetlija ivica; klik → lightbox galerija (u pravoj app).
  - **Dokument:** kartica `--inbg` + `--border2` radius 9 padding `9px 12px`: bedž tipa mono `700 8px` crven okvir („PDF"/„XLS") + ime `12px w700` + veličina mono `9px --text2`.
  - **Podeljena kartica reklamacije:** min 250px, `--surface` + `--border2`, radius 11, padding `12px 14px`: eyebrow „PODELJENA REKLAMACIJA" mono `600 8px tracking .16em` · MR mono `700 14px` + kind pill · ishod pill (tačka 5px + tinta `.13`) · partner `11.5px --text2` · „OTVORI NIT →" `10.5px w700 --redh`. Hover: lift −1px. Nastaje dugmetom „Podeli u razgovor" na detalju reklamacije.
  - **Futer poruke:** reakcija ✓ čip (mono `600 10px`, zelena `rgba(31,169,113,.12)` bg + `.35` ivica, radius 20, klik dodaje/skida svoju) · viđeno mono `500 9px --text2` („VIĐENO: SJ, DI" / „VIĐENO: SVI").
  - **Čip niti** (u kanalu, ispod poruke koja je iznedrila nit): `--surface` + `--border`, radius 10, padding `8px 12px`: kind tačka 6px · „Nit **MR NNNN/NN** · N poruke · {učesnici}" · „OTVORI →" crveno uppercase. Klik → nit.
- **Sistemska poruka:** centrirana pilula `--inbg` + `--border`, radius 20, padding `6px 12px`, mono `500 10.5px --text2`, amber `↻` prefiks, vreme `opacity .6`. Događaji: nit napravljena · ishod promenjen · prilog dodat u detalju · objavljeno klijentu · kategorija promenjena. **Sistemske poruke ne dižu popup niti brojač.**
- **„NOVO" separator:** linija `1px rgba(234,179,8,.4)` levo/desno + „NOVO" mono `700 8.5px tracking .18em` amber — na poziciji prve nepročitane pri ulasku; nestaje pri sledećem ulasku.
- **Izmena/brisanje svoje poruke:** hover meni (⋯) na svojoj poruci → Izmeni (inline, posle čega „izmenjeno") / Obriši (confirm; ostaje sistemski trag „Poruka obrisana"). Tuđe poruke — bez tih opcija.

## 5. COMPOSER (dno, `--surface`, gornja ivica)

- **Red brzih odgovora** (padding `10px 16px 0`): „BRZO:" mono `600 8px tracking .16em --text2` + čipovi `11px w600 --text2`, padding `5px 11px`, radius 20, `--border2` ivica, hover belo — dodir UBACUJE tekst u polje (ne šalje). Šabloni konfigurabilni (za sada fiksni: „Stigao motor", „Nalaz gotov", „Krećem", „Preuzeo sam").
- **Red unosa** (padding `10px 16px 12px`, gap 9): prilog dugme 36×40 (spajalica 15px) → picker slika/PDF/Excel · kamera dugme 36×40 (tablet: direktno slikanje) · **input 40px** flex 1, radius 9, `--inbg` + `--border2`, `13px`, crveni fokus ring; placeholder: kanal „Poruka… MR broj postaje link, @ pomen" / nit „Odgovori u nit…" · **POŠALJI** primarno dugme 40px (svetla ispuna `--btn`, `11px w700 tracking .06em`, senka, hover lift). Enter šalje; Shift+Enter novi red (textarea u pravoj app).
- **@ autocomplete:** kucanje `@` otvara meni članova (isti obrazac kao meni kategorija: `--raised`, radius 12, senka, redovi 31px); strelice + Enter biraju.

## 6. KONTEKST PANEL (desno, 250px — samo u niti, `fadeUp .3s`)

1. **Sekcija REKLAMACIJA** (donja ivica): eyebrow mono `600 8.5px tracking .18em` · MR mono `700 15px` + kind pill · ishod pill · partner + motor + „Zadužen: {ime}" `11.5px --text2 lh 1.5` · dugme **„OTVORI REKLAMACIJU →"** 32px outline (`--raised` + `--border2`, `10.5px w700`), vodi na detalj.
2. **PRIKAČENO · N** (ako ima): pin poruka u `--inbg` + `--border2` kartici, `11.5px`, autor prefiks `--text2`.
3. **PRILOZI IZ RAZGOVORA · N:** grid 3 kolone, kvadrati radius 7, `--inbg` + `--border2`, poslednji „+N" mono. Klik → galerija. **Prilozi iz niti se vide i u detalju reklamacije** (jedan izvor).
4. Futer (margin-top:auto, gornja ivica): italic `10.5px --text2` — napomena o obaveštenjima.

## 7. OBAVEŠTENJA (veže se na postojeći sistem zvona + glass popup)

- Nova poruka → item u zvonu + **glass popup** (postojeći obrazac iz `2026-07-22-popup-notifikacija-handoff.md`): eyebrow „PORUKA · {KANAL/MR} · UPRAVO", naslov = autor + skraćen tekst, akcije Otvori/Odloži/Odbaci.
- @pomen → poseban tip (eyebrow „POMENUO TE {IME}"), uvek stiže i kad je nit utišana.
- **Mute niti:** bez popup-a i bez ulaska u zbir badge-a; item u zvonu i dalje postoji. **DND:** pauzira SVE čet popup-e (zvono radi); vidljivo stanje na prekidaču.
- Badge-evi: po niti/kanalu u listi + zbir na stavci menija „Razgovori" (mute isključen iz zbira). Ulazak u razgovor nulira njegov brojač i postavlja „NOVO" separator.
- Viđeno: otvaranje razgovora šalje read receipt; „VIĐENO:" red se puni inicijalima, „SVI" kad su svi.

## 8. PONAŠANJA — pravila koja se NE preskaču

1. MR broj se linkifikuje SVUDA u čet tekstu (regex `MR \d{4}/\d{2}` — uskladi sa realnim formatom iz koda); ako reklamacija ne postoji, tekst ostaje običan.
2. Klik na MR link: nit postoji → otvori; ne postoji → ponudi „Napravi nit" (ne pravi tiho).
3. **1 reklamacija = 1 nit** (unique constraint) — svaki ulaz (poruka, „+", detalj) vodi u ISTU nit.
4. Deep-link na poruku: URL sa id-jem poruke → otvara razgovor, skroluje na poruku, kratko je istakne (tinta fade ~1.5s).
5. Tab „Razgovor" u detalju reklamacije = ista nit, isti composer, bez kontekst panela (kontekst JE detalj).
6. Snooze/„Odloži" na popup-u poruke ne dira nepročitano stanje.
7. Poruke se NE brišu fizički (soft delete + sistemski trag) — dokazni materijal za reklamacije.
8. Permisije: svi interni korisnici vide opšti kanal; kanali po članstvu; niti prate postojeću permisiju čitanja reklamacija (ko ne sme da vidi reklamaciju, ne vidi ni nit).
9. Auto-scroll na dno SAMO ako je korisnik već pri dnu; inače „↓ nove poruke" plutajuće dugme.
10. i18n kroz Paraglide, SR+EN paritet; EN duži ~35% — lista 252px mora da podnese (ellipsis).

## 9. DIJALOZI (overlay `rgba(0,0,0,.55)`, kartica 430px, `--surface` + `--border2`, radius 14, senka `0 28px 70px`, `fadeUp .25s`; Esc/klik van zatvara)

- **Nova nit:** header eyebrow „NOVA NIT" crveni mono + objašnjenje `12px --text2`; pretraga (38px input) „MR broj, partner, motor…"; lista reklamacija: red 44px — kind tačka 7px + MR mono `600 12px` + partner `10.5px --text2` + desno značka: postojeća nit → „NIT POSTOJI →" (`--border2` okvir, `--text2`) ili „NAPRAVI +" (zelena `rgba(31,169,113,.1)` tinta + `.4` ivica). Izbor: postojeća → otvori; nova → napravi (sistemska poruka „Nit napravljena — {ime}") + toast + otvori.
- **Novi kanal:** eyebrow „NOVI KANAL" + objašnjenje; polje NAZIV KANALA\* (40px, mono labela, crvena zvezdica); ČLANOVI kao čipovi (kreator fiksiran crvenom tintom, ostali toggle, „+ Dodaj" dashed); dugmad OTKAŽI outline + NAPRAVI KANAL primarno; Enter potvrđuje. Kanal se otvara odmah, sa sistemskom porukom o osnivanju.

## 10. API / model (predlog — prijavi odstupanja pre izrade)

- Entiteti: `Conversation {id, type: 'general'|'channel'|'claim', claimId?, name?, members[]}` · `Message {id, convId, authorId, text, attachments[], quoteOf?, editedAt?, deletedAt?, system?: {kind, meta}}` · `ReadState {convId, userId, lastReadMessageId}` · `Pin {convId, messageId}` · `Reaction {messageId, userId}` · `Mute {convId, userId}` + DND na profilu.
- Real-time: postojeći SSE kanal (isti koji hrani zvono) — event `chat:new-message` → invalidacija query-ja razgovora + popup logika.
- Nepročitano: server računa iz ReadState (broj po razgovoru + zbir), stiže uz postojeći summary.
- Linkifikacija: na renderu (klijent), NE u bazi — tekst se čuva sirov.
- Prilozi: postojeći upload sistem reklamacija (isti storage); prilog u niti se registruje i kao prilog reklamacije.

## 11. Redosled implementacije (svaki korak zeleni gate)

1. Model + API + SSE (bez UI) · 2. Ekran Razgovori: lista + opšti kanal + composer (tekst) · 3. Niti: MR linkifikacija, čip niti, „+" dijalog, kontekst panel, tab „Razgovor" u detalju · 4. Prilozi + kamera · 5. Obaveštenja: badge-evi, popup, @pomen, mute/DND, NOVO separator, viđeno · 6. Kanali + dijalog · 7. Poliranje: citat, izmena/brisanje, reakcije, pin, pretraga, deep-link, brzi odgovori.

## 12. Checklist za prijem

- [ ] Tri kolone tačnih širina (252 / flex / 250), panel samo u niti, ⓘ toggle.
- [ ] Lista: DND, pretraga, KANALI + „+", NITI + „+", badge/MUTE/aktivno stanje, kind tačke.
- [ ] MR broj u tekstu = plavi mono čip-link → nit; @pomen crveni čip.
- [ ] Poruka: avatar, vreme, izmenjeno, link-ikonica, citat, slike, PDF/XLS kartica, reakcija ✓, viđeno.
- [ ] Čip niti u kanalu + podeljena kartica reklamacije + „Podeli u razgovor" na detalju.
- [ ] Sistemske poruke (pilula, amber ↻) + NOVO separator.
- [ ] Composer: brzi odgovori, prilog, kamera, placeholder po režimu, POŠALJI primarno, Enter.
- [ ] Kontekst panel: kartica reklamacije, OTVORI REKLAMACIJU, prikačeno, prilozi.
- [ ] Oba dijaloga (nit sa pretragom i NAPRAVI +/NIT POSTOJI; kanal sa članovima).
- [ ] Obaveštenja: popup + zvono, @pomen kroz mute, DND, zbir na meniju, viđeno.
- [ ] Tab „Razgovor" u detalju = ista nit.
- [ ] BEZ „kuca…" indikatora i online tačke. Nijedno dugme puna crvena ispuna.

Handback: screenshotovi po checklisti (kanal, nit sa panelom, oba dijaloga, popup poruke, tab Razgovor u detalju) + odluke koje si doneo van dokumenta, eksplicitno. Commit posle odobrenja.
