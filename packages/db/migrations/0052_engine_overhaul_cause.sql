-- „Uzrok kvara" — what actually failed, as opposed to `sklop_u_kvaru` (WHERE it failed) and
-- `pojava_kvara` (how it was reported). The three together are the shop's answer to „zašto se
-- desilo", and none of them repeats a column the claim already carries.
--
-- Every option here hangs off an option of `sklop_u_kvaru` (migration 0051's `parent_option_id`),
-- so the list narrows to the assembly that was chosen: pick Glava and the causes offered are the
-- head's. The dependency lives on the option, so the office can add a cause to one assembly
-- without touching any other.
--
-- Nothing is required, like everything 0048 seeded: a required field refuses the whole create and
-- the wizard reports that as one banner at the end. The office turns it on from the admin panel.

INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT c."id", 'uzrok_kvara', 'Uzrok kvara', 'select', 15
FROM "claim_categories" c
WHERE c."code" = 'REMONT_MOTORA'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order", "parent_option_id")
SELECT cause."id", v.code, v.name, v.sort_order, parent."id"
FROM "claim_category_fields" cause
JOIN "claim_categories" c ON c."id" = cause."category_id" AND c."code" = 'REMONT_MOTORA'
JOIN "claim_category_fields" part
  ON part."category_id" = c."id" AND part."code" = 'sklop_u_kvaru'
CROSS JOIN (VALUES
  ('blok',       'blok_pukao',            'Pukao',                    10),
  ('blok',       'blok_ravan',            'Deformisana ravan',        20),
  ('blok',       'blok_leziste',          'Oštećeno ležišno mesto',   30),
  ('blok',       'blok_hilzne',           'Loše hilznovan',           40),
  ('blok',       'blok_korozija',         'Korozija ili kaverne',     50),
  ('blok',       'blok_navoj',            'Oštećen navoj',            60),
  ('glava',      'glava_pukla',           'Pukla',                    10),
  ('glava',      'glava_ravan',           'Deformisana ravan',        20),
  ('glava',      'glava_ventili',         'Ventili ne zaptivaju',     30),
  ('glava',      'glava_vodjice',         'Vođice istrošene',         40),
  ('glava',      'glava_sedista',         'Sedišta ventila',          50),
  ('glava',      'glava_dihtung',         'Zaptivka glave popustila', 60),
  ('radilica',   'radilica_rukavci',      'Oštećeni rukavci',         10),
  ('radilica',   'radilica_mera',         'Brušena van mere',         20),
  ('radilica',   'radilica_savijena',     'Savijena',                 30),
  ('radilica',   'radilica_pukla',        'Pukla',                    40),
  ('radilica',   'radilica_prirubnica',   'Oštećena prirubnica',      50),
  ('klipnjace',  'klipnjaca_savijena',    'Savijena',                 10),
  ('klipnjace',  'klipnjaca_oko',         'Oštećeno oko ili čaura',   20),
  ('klipnjace',  'klipnjaca_pukla',       'Pukla',                    30),
  ('klipnjace',  'klipnjaca_zavrtnji',    'Popustili zavrtnji',       40),
  ('klipovi',    'klip_karike',           'Polomljene karike',        10),
  ('klipovi',    'klip_zaribao',          'Klip zaribao',             20),
  ('klipovi',    'klip_dno',              'Oštećeno dno klipa',       30),
  ('klipovi',    'klip_zazor',            'Pogrešan zazor',           40),
  ('lezajevi',   'lezaj_zaribao',         'Zaribali',                 10),
  ('lezajevi',   'lezaj_strugotina',      'Oštećeni strugotinom',     20),
  ('lezajevi',   'lezaj_zazor',           'Pogrešan zazor',           30),
  ('lezajevi',   'lezaj_pomeren',         'Pomereni',                 40),
  ('razvod',     'razvod_kais',           'Kaiš ili lanac preskočio', 10),
  ('razvod',     'razvod_zategac',        'Zategač popustio',         20),
  ('razvod',     'razvod_bregasta',       'Bregasta oštećena',        30),
  ('razvod',     'razvod_podizaci',       'Podizači',                 40),
  ('pumpa_ulja', 'pumpa_pritisak',        'Nedovoljan pritisak',      10),
  ('pumpa_ulja', 'pumpa_zaribala',        'Zaribala',                 20),
  ('pumpa_ulja', 'pumpa_korpa',           'Usisna korpa zapušena',    30),
  ('turbina',    'turbina_ulje',          'Propušta ulje',            10),
  ('turbina',    'turbina_lopatica',      'Oštećena lopatica',        20),
  ('turbina',    'turbina_lezaj',         'Ležaj turbine',            30),
  ('turbina',    'turbina_podmazivanje',  'Loše podmazivanje',        40),
  ('zaptivke',   'zaptivka_glave',        'Zaptivka glave',           10),
  ('zaptivke',   'zaptivka_semering',     'Semering radilice',        20),
  ('zaptivke',   'zaptivka_karter',       'Zaptivka kartera',         30),
  ('zaptivke',   'zaptivka_ugradnja',     'Pogrešno ugrađena',        40),
  ('ostalo',     'ostalo',                'Ostalo',                   99)
) AS v(parent_code, code, name, sort_order)
JOIN "claim_category_field_options" parent
  ON parent."field_id" = part."id" AND parent."code" = v.parent_code
WHERE cause."code" = 'uzrok_kvara'
ON CONFLICT ("field_id", "code") DO NOTHING;
