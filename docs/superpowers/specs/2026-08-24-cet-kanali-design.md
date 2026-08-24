# Čet — kanali po temi (korak 6)

> Nastavak na `2026-08-23-cet-razgovori-design.md`. Kratak spec: **model već postoji** — tabela
> `chat_members`, pravilo vidljivosti i brisanje sobe su napisani i pokriveni testom u koraku 1.
> Fali način da se kanal napravi i da se ljudi dodaju.

---

## 1. Nikoline odluke, 24.08.

1. **Kanal pravi svako ko je u četu.** Kao što svako može da otvori nit reklamacije. Bez nove
   dozvole → **posle deploja ne treba `db:seed`**.
2. **Ljude dodaje onaj ko je napravio kanal, i admin.**
3. **Kanal bez ijednog člana OSTAJE**, i vidi ga samo admin — da odluči: obriši ili vrati nekoga.
4. Iz koraka 1 (§10 osnovnog spec-a, i dalje važi): kanal **briše i preimenuje onaj ko ga je
   napravio ili admin**; član sme da izađe; **Opšti kanal ni jedno ni drugo**.

---

## 2. Izmena koju odluka 3 zahteva

Danas kanal vidi **samo član** (`visibleConversationCondition`, `chat.repository.ts:187`). Kanal iz
kog su svi izašli zato ne vidi **niko — ni admin**: ne može da se otvori, ne može da se obriše, i
ostaje u bazi zauvek kao siroče.

**Ispravka je uska, namerno:** admin vidi kanal **bez ijednog člana**. NE vidi svaki kanal.

⚠ Razlika je bitna. „Admin vidi sve kanale" je druga funkcija i drugačija privatnost — soba u kojoj
troje ljudi razgovara o platama ne postaje javna zato što neko ima admin ulogu. Prazan kanal, s
druge strane, nije ničiji razgovor: nema kome da bude privatan.

```
OR (type = 'channel' AND (
      EXISTS (član = ja)
      OR (:jesamAdmin AND NOT EXISTS (bilo koji član))
   ))
```

---

## 3. Šta se dodaje

| ruta | ko sme | šta radi |
| --- | --- | --- |
| `POST /chat/channels` | svako u četu | pravi kanal; **tvorac je odmah član** |
| `PATCH /chat/conversations/:id` | tvorac ili admin | preimenuje |
| `POST /chat/conversations/:id/members` | tvorac ili admin | dodaje ljude |
| `DELETE /chat/conversations/:id/members/:userId` | tvorac ili admin | sklanja čoveka |
| `DELETE /chat/conversations/:id/members/me` | svako | izlazi sam |

Brisanje kanala već postoji (`DELETE /chat/conversations/:id`, admin).

⚠ **Tvorac postaje član u istoj transakciji.** Inače napravi sobu koju ne vidi — pravilo vidljivosti
traži članstvo, pa bi kanal nestao istog trenutka.

⚠ **Opšti kanal se ne preimenuje, ne napušta i nema članove.** Isti izuzetak koji već postoji za
brisanje (`chat.service.ts:523`), i iz istog razloga: to je jedina soba koja postoji za sve.

---

## 4. Ko sme šta — jedno mesto

`requireChannelOwner(conversation, actor)`: tvorac (`created_by`) **ili** admin po ULOZI.

⚠ Admin po **ulozi**, ne po dozvoli — čet nema svoju dozvolu, i to je isto rezonovanje po kome
admin skida tuđi pin (spec od 23.08.).

⚠ **404, nikad 403**, za sobu koju čovek ne sme da vidi. Za sobu koju vidi ali nije njegova — **403**:
postojanje kanala mu nije tajna, jer ga vidi u spisku.

---

## 5. Ekran

- **„+" pored KANALI** otvara prozorčić: ime + spisak ljudi sa pretragom (`listPeopleFor` već
  postoji i vraća baš one koji smeju u tu sobu).
- **Panel razgovora** za kanal dobija spisak članova sa ✕, dugme „Dodaj" i „Napusti kanal".
  ⚠ Danas `ThreadContextPanel` vraća `null` bez reklamacije — za kanal dobija svoj sadržaj.
- Preimenovanje: dvoklik na ime u zaglavlju, ili stavka u meniju — **odluka pri izradi**, jer
  prototip kanale ne crta.

---

## 6. Šta se NE radi

- Privatne poruke jedan-na-jedan (to je treća vrsta sobe, nije traženo).
- Javni kanali u koje se ulazi samo od sebe (Nikolina odluka: dodaje tvorac ili admin).
- Arhiviranje kanala. Postoji brisanje, i postoji prazan kanal koji admin vidi.
- Automatsko brisanje praznog kanala — ništa u ovom repou ne briše samo od sebe.

---

## 7. Zamke

1. **Tvorac koji nije član napravi nevidljivu sobu.** Ista transakcija ili ništa.
2. **Prazan kanal bez ispravke iz §2 je siroče** koje se ne može ni videti ni obrisati.
3. **`listPeopleFor` za kanal već vraća samo članove** (`chat.repository.ts:752`) — spisak za
   „dodaj čoveka" mora da bude DRUGI upit, inače nudi samo one koji su već unutra.
4. **Opšti kanal mora da bude izuzet na SVAKOJ novoj ruti**, ne samo na brisanju.
5. **Ime kanala nije jedinstveno u bazi** — dva „Nabavka" su dozvoljena. Namerno: ime nije ključ,
   a jedinstvenost bi tražila migraciju za problem koji niko nije prijavio.
6. **Član koji izlazi iz sobe koju je sam napravio** je dozvoljen — i tada soba ostaje bez tvorca
   koji je vidi. To je tačno slučaj iz §2.

---

## 8. Redosled

| # | Šta | Dokaz |
| --- | --- | --- |
| K1 | vidljivost praznog kanala za admina (§2) | prazan kanal: admin vidi, ostali ne |
| K2 | pravljenje kanala + tvorac kao član | tvorac odmah vidi svoj kanal |
| K3 | članovi: dodaj / skloni / izađi | tuđ kanal → 403; Opšti kanal → 422 |
| K4 | preimenovanje | isto pravilo kao brisanje |
| K5 | ekran: „+", panel kanala | prozorčić nudi one koji NISU članovi |

Bez migracije, bez nove dozvole, **bez `db:seed`**.
