# Čet — prijemna lista (živ dokument)

Prijemna lista iz handoff-a **§12, doslovno**, i uz svaku stavku: u kom koraku se pravi i da li je
urađena. Ovaj fajl se dopunjuje na kraju svakog koraka i on je ono što se gleda pri primopredaji.

**Zašto postoji:** Nikolina rečenica na startu — *„da ne bi došli ponovo do problema kao prošli put
sa dizajnom pa neke stvari nisu urađene"*. Stavka koja nema svoj korak je stavka koja će ispariti.

Legenda: ✅ urađeno · 🔄 u izradi · ⏳ čeka svoj korak · ❌ svesno van obima (sa razlogom)

**Korak 2 (ekran) je ZAVRŠEN 23.08.** — lista, Opšti kanal, poruke, composer, oporavak propuštenog.
Dokazano u pregledaču: poruka poslata, oznaka „šalje se" nestala kad je server potvrdio, Enter šalje,
i poruka je **sama stigla drugom nalogu za ~0,5 s**, bez ijedne greške u konzoli.

**Korak 1 (model, API, SSE) je ZAVRŠEN 23.08.** — devet zadataka, pun gejt zelen. Nijedna stavka
handoff-ove liste nije mogla biti zatvorena u njemu, jer su sve ekranske; ono što je korak 1
isporučio je drugi spisak ispod, i on je temelj na kome ekran stoji.

---

## Handoff §12 — prijemna lista

| # | stavka (doslovno iz handoff-a) | korak | stanje |
| --- | --- | --- | --- |
| 1 | Tri kolone tačnih širina (252 / flex / 250), panel samo u niti, ⓘ toggle | 2, 3 | 🔄 *(dve kolone stoje; panel i ⓘ su korak 3)* |
| 2 | Lista: DND, pretraga, KANALI + „+", NITI + „+", badge/MUTE/aktivno stanje, kind tačke | 2, 3, 6 | 🔄 *(sve stoji; pretraga zasivljena do koraka 7, „+" dijalozi su koraci 3 i 6)* |
| 3 | MR broj u tekstu = plavi mono čip-link → nit; @pomen crveni čip | 3 | ⏳ |
| 4 | Poruka: avatar, vreme, izmenjeno, link-ikonica, citat, slike, PDF/XLS kartica, reakcija ✓, viđeno | 2, 4, 7 | 🔄 *(avatar, vreme, izmenjeno gotovi; ostalo su koraci 4 i 7)* |
| 5 | Čip niti u kanalu + podeljena kartica reklamacije + „Podeli u razgovor" na detalju | 3 | ⏳ |
| 6 | Sistemske poruke (pilula, amber ↻) + NOVO separator | 2, 5 | 🔄 *(server ih piše od koraka 1: ishod, objava, promena kategorije)* |
| 7 | Composer: brzi odgovori, prilog, kamera, placeholder po režimu, POŠALJI primarno, Enter | 2, 4 | 🔄 *(sve osim priloga i kamere, koji su nacrtani i namerno neaktivni do koraka 4)* |
| 8 | Kontekst panel: kartica reklamacije, OTVORI REKLAMACIJU, prikačeno, prilozi | 3, 4, 7 | ⏳ |
| 9 | Oba dijaloga (nit sa pretragom i NAPRAVI +/NIT POSTOJI; kanal sa članovima) | 3, 6 | ⏳ |
| 10 | Obaveštenja: popup + zvono, @pomen kroz mute, DND, zbir na meniju, viđeno | 5 | ⏳ |
| 11 | Tab „Razgovor" u detalju = ista nit | 3 | ⏳ |
| 12 | BEZ „kuca…" indikatora i online tačke | — | ✅ *(ne pravi se; nema ga ni u modelu)* |
| 13 | Nijedno dugme puna crvena ispuna | 2 | ✅ |

---

## Dodatak: šta je van handoff-a, a mora da se preda

Ovo su odluke iz našeg spec-a §5 i §10 — nisu u handoff-ovoj listi, ali se isto tako dokazuju.

| stavka | korak | stanje |
| --- | --- | --- |
| Jedna reklamacija = jedna nit (dva parcijalna indeksa) | 1 | ✅ |
| Poruke preživljavaju gašenje naloga (`SET NULL`) | 1 | ✅ |
| `seq` kao jedini ključ redosleda | 1 | ✅ |
| Ponovljeno slanje upiše jednom (`client_msg_id`) | 1 | ✅ |
| Nepročitano je jedan broj i ne ide unazad (`GREATEST`) | 1 | ✅ |
| Čet stiže i nalogu sa ulogom napravljenom u panelu | 1 | ✅ |
| Klijent sa portala ne vidi ništa od četa | 1 | ✅ |
| Citat ostaje u svom razgovoru | 1 | ✅ |
| Opšti kanal postoji u svakom okruženju (seed) | 1 | ✅ |
| Nit reklamacije = ista kroz sva tri ulaza | 1 | ✅ |
| Sistemski događaj **ne pravi** nit | 1 | ✅ |
| Izmena samo 15 minuta, brisanje meko | 1 | ✅ |
| Oporavak propuštenog (`afterSeq` + preklapanje) — klijentska polovina | 2 | ✅ |
| Čuvar tišine 45 s + imenovan `ping` | 2 | ✅ |
| Optimističko slanje sa ponovnim pokušajem | 2 | ✅ |
| Pomeranje na dno samo ako već gledaš dno | 2 | ✅ |
| Živa isporuka drugom nalogu (dokazano u pregledaču, ~0,5 s) | 2 | ✅ |
| Prilozi iz četa se **ne vide klijentu** (`chat_attachment`) | 4 | ⏳ |
| Push: manifest, SW, pretplata, slanje, čišćenje | 5 | ⏳ |
| Prekidač po čoveku: sve poruke · samo pomeni · bez teksta | 5 | ⏳ |
| Vreme uvek `Europe/Belgrade` | 2 | ✅ |
| Pin (najviše 20), reakcija ✓, utišavanje niti — server | 1 | ✅ |
| Citat ostaje u svom razgovoru | 1 | ✅ |
| Obrisana poruka se ne može izmeniti nazad | 1 | ✅ |

---

## Svesno van obima ovog posla (piše se u primopredaji, ne prećutkuje se)

- **Telefon i tablet ispod 1024px** — prototip je crtan na 1440; poseban prolaz, kao što je urađen
  za reklamacije i prijem.
- **Izvoz razgovora** u PDF/Excel — handoff §8.7 zove poruke dokaznim materijalom, ali nigde ne
  traži da se izvoze.
- **„Skok na razgovor" u ⌘K paleti** — stavka menija stiže sama, pretraga razgovora ne.
- **Kamera u stranici** — zajedničko zaglavlje `permissions-policy: camera=()` je gasi u sve tri
  aplikacije. `<input capture>` (sistemska kamera) radi; pregled u stranici traži svoju odluku.
- **Glasovne poruke, „kuca…", online tačka** — handoff ih izričito odbija.
