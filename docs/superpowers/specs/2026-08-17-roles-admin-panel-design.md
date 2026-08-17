# Rolovi iz admin panela — dizajn

**Datum:** 2026-08-17
**Grana:** nova, iz `main`
**Prethodi mu:** prijem vozila je na live-u (`bde88d4`); Nikolina odluka 12.08. da rolovi idu posle
prijema (`docs/03-permissions.md` §OPEN), potvrđena i proširena 17.08.
**Status:** PREDLOG — prošao kroz svih šest oblasti sa Nikolom, kod nije počet

---

## 0. Rečnik — obavezan na ekranu i u prevodima

Reč „rola" se koristila na dva nivoa i to je Nikolu zbunilo (17.08.). Jedan rečnik, svuda:

| Reč | Značenje | NE koristiti |
| --- | --- | --- |
| **Ovlašćenje** | ono što se daje čoveku; nosi više radnji | „paket", „rola", „permission set" |
| **Radnja** | jedna konkretna stvar koju sme da uradi (`intake_orders.send_document` → „Šalje papir vlasniku na mejl") | „dozvola", „pravo", „permission" |
| **STANDARDNO** | ovlašćenje definisano u kodu; seed ga održava, nova radnja u njega upada sama | „ugrađena" |
| **TVOJE** | ovlašćenje koje je Nikola sam sastavio; seed ga ne dira | „vlastita", „custom" |
| **Odeljenje** | ko je čovek u firmi (evidencija) — **nikad ne daje prava** | — |

`Permission` i `role` ostaju imena u KODU; na ekranu i u `messages/*.json` idu reči iz ove tabele.

## 1. Zašto

> „Imamo role trenutno ali nemamo nikako da ih štelujemo u detalje… Šta ako sad hoćemo da napravimo
> novi role — moramo da ulazimo u kod pa deploy. Admin panel mora da bude spaceship."
> — Nikola, 17.08.2026

Ide **pre Faze 1** (njegova odluka): to je ono što ga koči danas, i svaka sledeća faza donosi nove
dozvole — bolje da padaju u panel koji već ume da se podešava.

## 2. Šta je provereno u kodu (a ne pretpostavljeno)

Šest nalaza. Tri od njih menjaju obim, dva su rupe koje postoje danas.

1. **Šema je cela tu. Migracija NE treba.** `roles` ima `code`, imena na oba jezika, `is_system`,
   `created_by`/`updated_by`, `deleted_at`. `role_permissions` je spoj (CASCADE ka roli, RESTRICT ka
   dozvoli). `permissions` ima `module` — što daje grupe na ekranu besplatno. Sve od migracije `0000`.
2. **API modul `roles` ne postoji, ekran ne postoji.** Pet `roles.*` dozvola stoji u katalogu i
   ništa ih ne koristi osim `roles.assign`.
3. ⚠ **97 dozvola nema ljudska imena** — `seedPermissions` upisuje sâm kod (`nameSr: code`) i prazan
   opis. Bez toga panel prikazuje `intake_orders.send_document` umesto „Slanje dokumenta vlasniku".
4. ⚠⚠ **27 od 97 dozvola ne proverava NIKO** (mereno, ne procenjeno — vidi §7). Katalog je pisan
   unapred, po planu, a delovi plana nikad nisu sagrađeni. Dve od njih su prave rupe: **iznosi se
   vide svakome ko vidi statistiku**, i **fotografija se pri kačenju može označiti kao vidljiva
   klijentu bez ijedne provere.**
5. ✅ **Admin se ne može zaključati.** Ko drži `admin`, dobija `ADMIN_PERMISSIONS` iz koda i baza se
   uopšte ne čita (`packages/auth/src/permissions.ts:32`). Nijedan klik u panelu to ne menja.
6. ⚠⚠ **Razrešivač NE filtrira obrisane role** (`permissions.ts:41` i `:58`). Danas bezopasno jer se
   rola nikad ne briše. **Čim panel dobije brisanje, obrisana rola bi i dalje davala prava.**

Ostalo zatečeno: keš dozvola je 5 minuta (`cachedByRoles`); `revokeUserSessions` postoji; dodela
role je zakucana na tri koda (`user-roles-edit-dialog.tsx`); zaštita super-admin naloga postoji;
admin ima generički `ResourceListPage` koji spisak rola koristi kao i katalozi.

## 3. Model — sabiranje, ne oduzimanje

Problem koji ovo rešava ima ime: **role explosion** (Salesforce ga zove *profile sprawl*) — kloniranje
role za svaku sitnu razliku dok ih ne bude pedeset i dok se više ne zna ko je šta.

**Prvi predlog ovog spec-a bio je upravo to** („umnoži operatera pa skini jedno pravo") i Nikola ga
je oborio. Ispravno: **male, nezavisne role koje se sabiraju.** Tri kockice daju osam kombinacija a
održavaš tri stvari.

```
Marko     [Prijem — rad] [Prijem — kancelarija]
Dušica    [Prijem — rad] [Prijem — kancelarija] [Slanje dokumenta]
Jovan     [Prijem — rad] [Reklamacije — pregled]
```

Nema role „Operater bez slanja". Razlika je vidljiva pločica. **Model ispod se ne menja** — sistem
već dozvoljava više rola po čoveku sa sabiranjem prava; menja se samo oblik rola.

### 3.1 Dve ose koje se nikad ne mešaju

**Šta čovek SME** = role. **Ko je čovek U FIRMI** = `employees.department_id` (21 odeljenje, 125
radnika, već u produkciji) preko `employees.user_id`, veze naloga i radnika koja **već postoji u
šemi i stoji prazna**.

⚠ **Odeljenje NIKAD ne daje prava.** Čim „Glava" počne nešto da otključava, role explosion se vraća
na zadnja vrata. Popunjavanje te veze je ionako neophodno za Fazu 3 („radnik prijavljuje") — bez nje
se ne zna ko je prijavio.

### 3.2 Tri pravila izvedena u razgovoru

1. **Svaki paket radi sam za sebe.** Ako poslu treba pravo čitanja iz druge oblasti, ono ulazi u taj
   paket i kad se ponavlja. *(Nađeno merenjem: `GET /api/customers` i `/api/employees` traže svoja
   izričita prava — paket „Reklamacije — obrada" bez njih daje formu sa praznim padajućim listama.)*
2. **Opasne operacije ne ulaze u biblioteku** — ostaju admin-only. Nisu tajna; prosto se ne dele u
   prolazu.
3. **U matrici sme da stoji samo prekidač koji nešto stvarno kontroliše.** Prekidač koji ne radi je
   gori od njegovog odsustva — skineš kvačicu, misliš da si zabranio, a nisi.

## 4. Bezbednost — pet garancija

1. **Admin se ne može zaključati** (§2.5, postoji).
2. **Ne možeš dati ono što sam nemaš.** Rolu koja sadrži neko pravo možeš da napraviš ili dodeliš
   samo ako to pravo i sam držiš — provera na serveru. Ovo je pravilo iz Kubernetes RBAC-a i ono
   zatvara penjanje uz lestvicu u korenu: ko nema slanje dokumenata **ne može da napravi rolu koja
   ga daje**, ni sebi ni drugom.
3. **Niko ne menja role sopstvenog naloga** — ni admin. Server odbija.
4. **Izmena dejstvuje odmah:** obara keš i **gasi sesije svih koji rolu drže.** Bez toga čovek
   zadržava oduzeto pravo do sedam dana.
5. **Zaštićeni super-admin nalog** ostaje netaknut.

⚠ **Pošteno do kraja:** ako neko provali admin nalog, ništa od ovoga ga ne zaustavlja — to ne
zaustavlja nijedan sistem. Ovo štiti od toga da se neko sa **delimičnim** pravima popne do svih.

### Nikad u biblioteci — samo admin

| Dozvola | Zašto |
| --- | --- |
| `users.reset_password` | **postavlja tuđu lozinku** (`setPassword`, ne link na mejl) → ulazak na tuđ nalog. Najkraći put do svega |
| `users.create` · `users.delete` | pravljenje i brisanje naloga |
| `roles.create` · `update` · `delete` | sam panel; delegira se tek kad se pravilo br. 2 dokaže u radu |
| `settings.app_settings.manage_secrets` | ključevi i lozinke servisa |

## 5. Spisak standardnih ovlašćenja — 21, definisano u kodu

Seed ih održava, kao i pet ugrađenih (`is_system = true`) — znači **nova dozvola ubuduće stiže u njih
sama**. Nikoline vlastite role (`is_system = false`) su izmenjive iz panela i njih seed ne dira.

### Prijem vozila
| Paket | Dozvole |
| --- | --- |
| Prijem — rad na terenu | `intake_orders.view_own · create · update · advance` |
| Prijem — kancelarija | `intake_orders.view · change_status · delete` *(tuđe; svoj nacrt briše svako ko ga je počeo)* |
| Prijem — slanje dokumenta | `intake_orders.send_document` |
| Prijem — samo pregled | `intake_orders.view` |

### Reklamacije
| Paket | Dozvole |
| --- | --- |
| Reklamacije — pregled | `emotive.view · domace.view · attachments.view_internal · claim_reports.view · customers.view · employees.view` |
| Reklamacije — obrada | `emotive.create/update · domace.create/update · attachments.upload/delete_own · claim_reports.update/export · customers.view · employees.view · settings.engine_types.create · settings.external_parties.create` |
| Reklamacije — odluka o ishodu | `emotive.change_outcome · domace.change_outcome` |
| Reklamacije — šta klijent vidi | `emotive.publish · attachments.change_visibility` |
| Reklamacije — brisanje i arhiva | `emotive.delete/restore · domace.delete/restore · attachments.delete_any` |

*(Dva `*.create` prava iz podešavanja su ovde namerno: to je ono što operateru dozvoljava da doda tip
motora koji fali **dok unosi reklamaciju**, a ne da bude administrator šifarnika.)*

### Kupci i radnici
| Paket | Dozvole |
| --- | --- |
| Kupci — vođenje | `customers.view · create · update · delete` |
| Radnici — vođenje | `employees.view · create · update · deactivate · delete` |
| Radnici — učinak | `employees.view · view_analytics` |

### Brojke
| Paket | Dozvole |
| --- | --- |
| Statistika | `statistics.view_emotive · view_domace` |
| Statistika — novac | `statistics.view_financial` |
| Izvoz u Excel | `export.workbook_full · workbook_partial` |

### Portal i sanduče
| Paket | Dozvole |
| --- | --- |
| Pristiglo — prijave klijenata | `client_submissions.manage` |
| Obaveštenja | `notifications.view_own` |

⚠ **Klijent ostaje zatvoren.** Sedam dozvola portala **ne postaju pločice** i ne mogu se dati čoveku
iz firme. `view_own_customer` nije „vidi manje" nego *„vidi samo redove svoje firme"* — čovek iz
firme nema firmu. Rola `klijent` se i danas dodeljuje samo kroz odobravanje, uz vezivanje za firmu
(`APPROVE_REGISTRATION_ROLE_CODES` je već isključuje). Ostaje tako.

### Kontrolna tabla
| Ovlašćenje | Radnje |
| --- | --- |
| Korisnici — pregled | `users.view` |
| Šifarnici — reklamacije | `settings.departments · engine_types · engine_manufacturers (manage+create) · external_parties · claim_sources` |
| Šifarnici — prijem | `settings.intake_checklist · intake_damage_types · intake_arrival_modes` |
| Istorija | `audit.view` |

⚠ **Nikolina odluka 17.08., posle demoa: prava dodeljuje ISKLJUČIVO super-admin nalog.** Nema
delegiranja — svi ostali su radnici. Zato **četiri ovlašćenja izlaze iz spiska** i sele se među
admin-only radnje: `roles.assign` (dodela), `users.approve_registration`/`reject_registration` +
`customers.link_users` (odobravanje daje čoveku rolu, dakle daje prava), `users.deactivate`, i
`settings.app_settings.view/update`.

Pravilo **„ne možeš dati ono što sam nemaš" (§4.2) se svejedno gradi**, iako ga danas niko neće
sresti. Košta desetak linija i jedini je razlog zbog kog bi se sutra deo ovog posla mogao bezbedno
predati nekome; naknadno ga je nemoguće dodati bez prepravke.

**Spisak ima 21 standardno ovlašćenje**, ne 25.

## 6. Ekran

**Admin → Rolovi.** Spisak: naziv, broj ljudi koji je drže, značka **UGRAĐENA** / **VLASTITA**, broj
dozvola. `Umnoži` na svakoj; `Izmeni`/`Obriši` samo na vlastitim.

**Izmena** = ime (sr/en), opis, pa **matrica po modulima** (kolona `module` daje grupe): po grupi
„sve / ništa", pa kvačice sa ljudskim imenom i opisom ispod. Dole rečenica koja imenuje posledicu:
**„Ovo drži 3 osobe — biće im prekinuta prijava."** Kvačica koju sam aktor nema je **mrtva**, sa
objašnjenjem — to je pravilo br. 2 iz §4, vidljivo na ekranu a suđeno na serveru.

Ugrađena rola se otvara u istom ekranu, bez izmene, sa trakom „umnoži je da bi menjao".

**Rola u upotrebi se ne briše** — dugme mrtvo dok je drži bar jedan čovek, uz broj. Brisanje je meko.

## 7. Presuda za 27 neproveravanih dozvola

**🗑 Briše se (13):** `observations.*` (svih 7 — modul nikad nije napravljen, zamenili su ga
**Nalazi**, migracija `0031`; tabela stoji prazna) · `emotive_claims.unarchive` +
`domace_claims.unarchive` (vađenje iz arhive je obična promena ishoda) · `import.legacy_excel` (uvoz
je skripta u konzoli, nema šta da čuva) · `translation.request` + `translation.manage_cache` (modul
ne postoji) · `users.manage_2fa` (admin ne upravlja tuđim 2FA).

**🔨 Pravi se (10):**

| Dozvola | Šta se pravi |
| --- | --- |
| ⚠ `statistics.view_financial` | **RUPA:** iznosi se danas vide svakome ko vidi statistiku |
| ⚠ `attachments.change_visibility` | **RUPA:** pri kačenju se fotografija može označiti kao vidljiva klijentu bez ijedne provere |
| `employees.view_analytics` | čuva „ko je koliko kvarova napravio" — danas otvoreno svakome sa statistikom |
| `roles.view` · `roles.create` | koristi ih panel iz ovog posla |
| `settings.intake_damage_types.manage` | ekran fali (od tri šifarnika prijema samo ček-lista ga ima) |
| `settings.intake_arrival_modes.manage` | ekran fali |
| `settings.app_settings.view · update · manage_secrets` | ekran za podešavanja — vrednosti se čitaju iz baze (npr. da li klijent dobija mejl o ishodu) ali se **nigde ne mogu promeniti**. Nikolina odluka 17.08.: pravi se sada |

**⏸ Čeka svoju funkciju (4):** `employee_output.view` + `update` (brojilac „koliko je motora sklopljeno
mesečno" — Excel ga **već čita**, niko ga ne puni, pa PROCENAT računa protiv nule; odložen sa
sastanka) · `users.update` (izmena imena/mejla — nema rutu) · `audit.export`.

**Posle ovoga: 97 → 84 dozvole, sve proveravane. Panel prikazuje 84 prekidača i svaki nešto radi.**

## 8. Zadaci — svaki se završava svojim komitom

| # | Šta | Migracija |
| --- | --- | --- |
| R-0 | **Čišćenje kataloga:** brisanje 13 mrtvih (uz uklanjanje njihovih redova po rolama — strani ključ je RESTRICT) + **test koji pada ako neka dozvola u katalogu nije nigde proverena.** Od tada je nemoguće dodati prekidač koji ne radi | ne |
| R-1 | **Ljudska imena za 84 dozvole** (sr + en, ime i kratak opis) + seed prelazi na upis-preko-postojećeg za te kolone; današnji `onConflictDoNothing` bi ostavio kodove zauvek | ne |
| R-2 | **Dve rupe:** `statistics.view_financial` i `attachments.change_visibility` dobijaju svoje provere. Ide odvojeno i prvo — to su greške koje postoje danas, nezavisno od panela | ne |
| R-3 | API modul `roles`: spisak sa brojem korisnika, `create`, `update` (ime + set dozvola u jednoj transakciji), `duplicate`, meko `delete`. Uz njega **pravilo „ne možeš dati ono što nemaš"**, **filter obrisanih rola u razrešivaču**, obaranje keša, gašenje sesija držalaca, audit | ne |
| R-4 | **21 standardno ovlašćenje** u seed-u + `employees.view_analytics` gate | ne |
| R-5 | Admin ekran: spisak rola + matrica po modulima + „Umnoži" + i18n | ne |
| R-6 | Dodela rola prestaje da bude zakucana na tri koda — čita spisak iz API-ja | ne |
| R-7 | **Podešavanja aplikacije** — ekran + rute (`app_settings.view/update`, tajne odvojeno) | ne |
| R-8 | **Dva ekrana šifarnika prijema** koji fale: vrste oštećenja i načini dolaska | ne |
| R-9 | Straže pod testom: admin se ne zaključava · niko ne menja sopstvene role · obrisana rola ne daje prava · ne može se dati pravo koje sam nemaš · izmena obara keš i gasi sesije · rola u upotrebi se ne briše | ne |

**Nijedna migracija u celom poslu.**

## 9. Odvojeno, malo

**Brisanje potpisanog naloga prijema — samo admin** (Nikolina odluka 17.08.). Danas ga ne može niko:
`delete()` baca na `signedAt !== null` jer je potpisan nalog firmina polovina dokumenta koji vlasnik
drži. Menja se u: admin sme, kroz `<ConfirmDialog>` koji imenuje posledicu, sa svojim redom u
Istoriji. Nedovršen nacrt se briše kao i dosad. Svoj zadatak, svoj komit.

## 10. Šta ovaj posao NE radi

- **Bez dozvola po pojedinačnom korisniku** — sve ide kroz role; čovek drži više njih i prava se
  sabiraju.
- **Ne uvodi ulogu „radnik"** — to je Faza 3, i posle ovoga postaje **klik u panelu umesto izmene
  koda**, što je pola razloga zašto ovo ide prvo.
- **Ne popunjava vezu nalog↔radnik** (`employees.user_id`) — to ide uz Fazu 3, gde i zatreba.
- **Ne dira model dozvola** — atomične su i ostaju definisane u kodu.

## 11. Dokaz pre komita

Pun gejt pod `TZ=UTC`. Svaka straža iz R-9 mora biti **viđena crveno** pre nego što se prizna
(mutaciono). Prolaz kroz pregledač: napravi rolu umnožavanjem, skini joj jedno pravo, dodeli je
čoveku, pa proveri da mu je to pravo nestalo **odmah**, a ne za pet minuta.
