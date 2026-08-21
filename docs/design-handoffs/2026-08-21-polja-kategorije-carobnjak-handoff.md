# Dopuna: „Polja kategorije" u čarobnjaku — menjaju se sa kategorijom

**Za:** Claude Code · **App:** `internal-web` · **Datum:** 21.08.2026
**Dopunjuje:** `2026-08-21-kategorije-design-handoff.md` (§3 korak PODACI, §4 detalj, §9). Ako si korak PODACI već počeo po prvoj verziji — uskladi sa ovim pre nastavka.
**Vizuelna referenca:** nova verzija `kategorije-prototip.dc.html` — čarobnjak, korak „Osnovni podaci", menjaj kategoriju čipom ▾ u zaglavlju.

## Šta se menja

Grupa **„POLJA KATEGORIJE"** (dashed okvir ispod osnovnih polja) NIJE statična — sadržaj joj određuje izabrana kategorija, **config-driven po `categoryId`**:

1. **Kategorija prikazuje SAMO svoja polja.** Polja druge kategorije se uopšte ne renderuju — pa ne mogu ni da se pogrešno selektuju/popune. Primer iz prototipa: „Obrađeni deo" (Glava/Blok/Radilica) postoji samo za Mašinsku obradu; Generalni remont ga NEMA (mašinsko se tamo ne radi) — on ima svoja polja.
2. **Kategorija bez definisanih polja** → grupa se uopšte ne prikazuje (ne prazan okvir). U prototipu: Auto-servis, Elektro usluge.
3. **Promena kategorije čipom ▾ odmah zamenjuje grupu polja.** Ako su polja stare kategorije već popunjena — confirm dijalog pre odbacivanja tih vrednosti (u čarobnjaku, pre čuvanja, vrednosti se smeju odbaciti; posle čuvanja važi poseban dokument `2026-08-21-promena-kategorije-handoff.md`).
4. **Isti config hrani i detalj** — karticu „Polja kategorije" (tri stanja iz §9: popunjeno / „Nije popunjeno" italic / UKINUTO sa sačuvanom vrednošću).

## Vizuelna pravila (iz prototipa)

- Grupa: dashed okvir `1px dashed --mri-border2`, radius 12px, padding 15px; header mono eyebrow „POLJA KATEGORIJE · {KATEGORIJA}".
- Polja u 2-kolonskom gridu, mono labele (9.5px, tracking .13em), obavezna sa crvenom zvezdicom.
- Tip polja iz config-a: segmented (aktivan segment crvena tinta `.13` + crvena ivica `.5`) ili input (standardni obrazac, crveni fokus ring); kasnije po potrebi i drugi tipovi.
- Kategorija bez polja: grupa se ne renderuje (u prototipu je prikazana italic poruka samo radi demonstracije).

## Config mehanizam (šta se pravi SADA, šta NE)

- **Pravi se:** config sloj (npr. `categoryFieldsConfig: Record<categoryId, FieldDef[]>` — `FieldDef = { key, label, type: 'segmented'|'text'|…, options?, required?, mono? }`), rendering u čarobnjaku + kartici detalja, prazna stanja. Config je trenutno **PRAZAN**.
- **NE pravi se:** stvarna polja u bazi/API-ju. Polja iz prototipa (Obrađeni deo, Mera obrade (mm), Obim remonta, Stanje bloka pri prijemu, Kataloški broj dela, Dobavljač) su **ILUSTRATIVNI primeri** — stvarnu šemu po kategoriji vlasnik tek definiše i odobrava. Kad je odobri, polja ulaze kao config + migracija, bez izmene UI mehanizma.

## Prihvatanje

- [ ] Promena kategorije u čarobnjaku menja grupu polja bez ostataka stare kategorije.
- [ ] Popunjena stara polja → confirm pre odbacivanja.
- [ ] Kategorija bez polja → grupe nema; sa praznim config-om čarobnjak radi identično današnjem.
- [ ] Segmented/input obrasci po `--mri-*` tokenima, mono labele, crveni fokus.
- [ ] Vrednosti polja ulaze u korak PREGLED (key/value redovi) — kao u prototipu.
- [ ] i18n kroz Paraglide (labele polja dolaze iz config-a — planiraj prevodive labele), SR+EN paritet.

Ako nešto ne može da se pomiri sa postojećim kodom — pitaj, ne improvizuj.
