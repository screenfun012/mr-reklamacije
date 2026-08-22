-- The starting catalogue of per-category fields, so the office is not asked to type fourteen
-- fields and sixty options into the admin panel before the feature does anything. Every one of
-- them stays editable there: rename, reorder, switch off, or add your own.
--
-- Two rules the content follows, and they are the reason nothing here duplicates a column:
--   * a fact the claim already carries (engine type, engine code, dates, amounts, customer,
--     assigned worker) is NOT repeated as a category field;
--   * blame is not a field — "Krivica pripisana" already points at a worker, a department or an
--     external party through its own catalogue, so there is no "Dobavljač" field here.
--
-- Nothing is required (`is_required` keeps its `false` default): a required field refuses the
-- whole create, and today the wizard reports that as one banner at the end rather than under the
-- field. The office turns a field required in the admin panel when it wants that.

-- REMONT MOTORA — a remanufactured engine came back: which assembly, how it showed, how far it
-- ran, and who installed it (the last one decides most warranty arguments).
INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT c."id", v.code, v.name, v.field_type, v.sort_order
FROM "claim_categories" c
CROSS JOIN (VALUES
  ('sklop_u_kvaru', 'Sklop u kvaru', 'select', 10),
  ('pojava_kvara', 'Kako se kvar ispoljio', 'select', 20),
  ('predjeno_km', 'Pređeno km od ugradnje', 'text', 30),
  ('ko_je_ugradio', 'Ko je ugradio motor', 'select', 40)
) AS v(code, name, field_type, sort_order)
WHERE c."code" = 'REMONT_MOTORA'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order")
SELECT f."id", v.code, v.name, v.sort_order
FROM "claim_category_fields" f
JOIN "claim_categories" c ON c."id" = f."category_id"
JOIN (VALUES
  ('sklop_u_kvaru', 'blok', 'Blok', 10),
  ('sklop_u_kvaru', 'glava', 'Glava', 20),
  ('sklop_u_kvaru', 'radilica', 'Radilica', 30),
  ('sklop_u_kvaru', 'klipnjace', 'Klipnjače', 40),
  ('sklop_u_kvaru', 'klipovi', 'Klipovi i karike', 50),
  ('sklop_u_kvaru', 'lezajevi', 'Ležajevi', 60),
  ('sklop_u_kvaru', 'razvod', 'Razvod', 70),
  ('sklop_u_kvaru', 'pumpa_ulja', 'Pumpa za ulje', 80),
  ('sklop_u_kvaru', 'turbina', 'Turbina', 90),
  ('sklop_u_kvaru', 'zaptivke', 'Zaptivke', 100),
  ('sklop_u_kvaru', 'ostalo', 'Ostalo', 110),
  ('pojava_kvara', 'ne_pali', 'Ne pali / ne radi', 10),
  ('pojava_kvara', 'gubi_ulje', 'Gubi ulje', 20),
  ('pojava_kvara', 'gubi_antifriz', 'Gubi rashladnu tečnost', 30),
  ('pojava_kvara', 'buka', 'Kucanje ili buka', 40),
  ('pojava_kvara', 'dim', 'Dim iz auspuha', 50),
  ('pojava_kvara', 'gubitak_snage', 'Gubitak snage', 60),
  ('pojava_kvara', 'pregrevanje', 'Pregrevanje', 70),
  ('pojava_kvara', 'lampica', 'Lampica na tabli', 80),
  ('pojava_kvara', 'ostalo', 'Ostalo', 90),
  ('ko_je_ugradio', 'mr_engines', 'MR Engines', 10),
  ('ko_je_ugradio', 'ovlasceni_servis', 'Ovlašćeni servis', 20),
  ('ko_je_ugradio', 'drugi', 'Drugi servis ili kupac', 30)
) AS v(field_code, code, name, sort_order) ON v.field_code = f."code"
WHERE c."code" = 'REMONT_MOTORA'
ON CONFLICT ("field_id", "code") DO NOTHING;
--> statement-breakpoint
-- MAŠINSKA OBRADA — "Obrađeni deo" arrived with 0046 and keeps its three parts; the shop also
-- machines connecting rods and flywheels, so the list grows to match its own departments.
INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT c."id", v.code, v.name, v.field_type, v.sort_order
FROM "claim_categories" c
CROSS JOIN (VALUES
  ('vrsta_obrade', 'Vrsta obrade', 'select', 20),
  ('mera_obrade', 'Mera obrade', 'text', 30),
  ('prijavljena_pojava', 'Šta je prijavljeno', 'select', 40)
) AS v(code, name, field_type, sort_order)
WHERE c."code" = 'MASINSKA_OBRADA'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order")
SELECT f."id", v.code, v.name, v.sort_order
FROM "claim_category_fields" f
JOIN "claim_categories" c ON c."id" = f."category_id"
JOIN (VALUES
  ('obradjeni_deo', 'klipnjaca', 'Klipnjača', 40),
  ('obradjeni_deo', 'zamajac', 'Zamajac', 50),
  ('obradjeni_deo', 'ostalo', 'Ostalo', 60),
  ('vrsta_obrade', 'brusenje', 'Brušenje', 10),
  ('vrsta_obrade', 'honovanje', 'Honovanje', 20),
  ('vrsta_obrade', 'planiranje', 'Planiranje', 30),
  ('vrsta_obrade', 'busenje', 'Bušenje ili proširenje', 40),
  ('vrsta_obrade', 'caure', 'Presovanje čaura', 50),
  ('vrsta_obrade', 'varenje', 'Varenje', 60),
  ('vrsta_obrade', 'ispitivanje', 'Ispitivanje na pritisak', 70),
  ('vrsta_obrade', 'balansiranje', 'Balansiranje', 80),
  ('vrsta_obrade', 'ostalo', 'Ostalo', 90),
  ('prijavljena_pojava', 'mera_van_tolerancije', 'Mera van tolerancije', 10),
  ('prijavljena_pojava', 'curenje', 'Curenje', 20),
  ('prijavljena_pojava', 'pukotina', 'Pukotina', 30),
  ('prijavljena_pojava', 'vibracije', 'Vibracije', 40),
  ('prijavljena_pojava', 'ne_naleze', 'Ne naleže', 50),
  ('prijavljena_pojava', 'losa_povrsina', 'Loša površina', 60),
  ('prijavljena_pojava', 'ostalo', 'Ostalo', 70)
) AS v(field_code, code, name, sort_order) ON v.field_code = f."code"
WHERE c."code" = 'MASINSKA_OBRADA'
ON CONFLICT ("field_id", "code") DO NOTHING;
--> statement-breakpoint
-- NOVI DELOVI — a part sold over the counter came back: what it is, its catalogue number, and
-- what went wrong with it.
INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT c."id", v.code, v.name, v.field_type, v.sort_order
FROM "claim_categories" c
CROSS JOIN (VALUES
  ('vrsta_dela', 'Vrsta dela', 'select', 10),
  ('kataloski_broj', 'Kataloški broj', 'text', 20),
  ('razlog_reklamacije', 'Razlog reklamacije', 'select', 30)
) AS v(code, name, field_type, sort_order)
WHERE c."code" = 'NOVI_DELOVI'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order")
SELECT f."id", v.code, v.name, v.sort_order
FROM "claim_category_fields" f
JOIN "claim_categories" c ON c."id" = f."category_id"
JOIN (VALUES
  ('vrsta_dela', 'turbina', 'Turbina', 10),
  ('vrsta_dela', 'pumpa_vp', 'Pumpa visokog pritiska', 20),
  ('vrsta_dela', 'dizne', 'Dizne', 30),
  ('vrsta_dela', 'zaptivke', 'Set zaptivki', 40),
  ('vrsta_dela', 'klipovi', 'Klipovi i karike', 50),
  ('vrsta_dela', 'lezajevi', 'Ležajevi', 60),
  ('vrsta_dela', 'razvod', 'Razvod (lanac ili kaiš)', 70),
  ('vrsta_dela', 'vodena_pumpa', 'Vodena pumpa', 80),
  ('vrsta_dela', 'pumpa_ulja', 'Pumpa za ulje', 90),
  ('vrsta_dela', 'hladnjak', 'Hladnjak', 100),
  ('vrsta_dela', 'elektrika', 'Elektrika i senzori', 110),
  ('vrsta_dela', 'ostalo', 'Ostalo', 120),
  ('razlog_reklamacije', 'otkazao', 'Otkazao u radu', 10),
  ('razlog_reklamacije', 'neispravan', 'Neispravan iz kutije', 20),
  ('razlog_reklamacije', 'pogresan', 'Isporučen pogrešan deo', 30),
  ('razlog_reklamacije', 'ne_odgovara', 'Ne odgovara po katalogu', 40),
  ('razlog_reklamacije', 'transport', 'Oštećen u transportu', 50),
  ('razlog_reklamacije', 'nedostaje', 'Nedostaje deo iz kompleta', 60),
  ('razlog_reklamacije', 'ostalo', 'Ostalo', 70)
) AS v(field_code, code, name, sort_order) ON v.field_code = f."code"
WHERE c."code" = 'NOVI_DELOVI'
ON CONFLICT ("field_id", "code") DO NOTHING;
--> statement-breakpoint
-- AUTO-SERVIS — work done on the customer's own vehicle: which job, how the fault showed, and
-- how far the car ran since.
INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT c."id", v.code, v.name, v.field_type, v.sort_order
FROM "claim_categories" c
CROSS JOIN (VALUES
  ('vrsta_usluge', 'Vrsta usluge', 'select', 10),
  ('pojava_kvara', 'Kako se kvar ispoljio', 'select', 20),
  ('predjeno_km', 'Pređeno km od servisa', 'text', 30)
) AS v(code, name, field_type, sort_order)
WHERE c."code" = 'AUTO_SERVIS'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order")
SELECT f."id", v.code, v.name, v.sort_order
FROM "claim_category_fields" f
JOIN "claim_categories" c ON c."id" = f."category_id"
JOIN (VALUES
  ('vrsta_usluge', 'ugradnja_motora', 'Ugradnja motora', 10),
  ('vrsta_usluge', 'redovan_servis', 'Redovan servis', 20),
  ('vrsta_usluge', 'dijagnostika', 'Dijagnostika', 30),
  ('vrsta_usluge', 'kvacilo_menjac', 'Kvačilo i menjač', 40),
  ('vrsta_usluge', 'hladjenje', 'Sistem hlađenja', 50),
  ('vrsta_usluge', 'elektrika', 'Elektrika', 60),
  ('vrsta_usluge', 'ostalo', 'Ostalo', 70),
  ('pojava_kvara', 'ne_pali', 'Ne pali / ne radi', 10),
  ('pojava_kvara', 'gubi_ulje', 'Gubi ulje', 20),
  ('pojava_kvara', 'buka', 'Buka', 30),
  ('pojava_kvara', 'gubitak_snage', 'Gubitak snage', 40),
  ('pojava_kvara', 'pregrevanje', 'Pregrevanje', 50),
  ('pojava_kvara', 'lampica', 'Lampica na tabli', 60),
  ('pojava_kvara', 'ostalo', 'Ostalo', 70)
) AS v(field_code, code, name, sort_order) ON v.field_code = f."code"
WHERE c."code" = 'AUTO_SERVIS'
ON CONFLICT ("field_id", "code") DO NOTHING;
