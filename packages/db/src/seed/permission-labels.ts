import type { Permission } from '@mr/shared'

export interface PermissionLabel {
  readonly nameSr: string
  readonly nameEn: string
  readonly descriptionSr: string
  readonly descriptionEn: string
}

/**
 * What each action is CALLED on the roles screen. Data, not interface text: it lives in
 * `permissions.name_sr/name_en`, so the panel reads it from the API in the reader's language and
 * these strings never ship in a bundle.
 *
 * The name is a sentence about a person — "Šalje papir vlasniku na mejl", not "send_document" —
 * because an admin ticking a box has to know what they are handing out. The description is for the
 * cases where the name alone would mislead: an action that only a portal client ever holds, one
 * whose screen does not exist yet, one that is a shorter road to somebody else's account than it
 * looks.
 *
 * Typed as `Record<Permission, …>`: a new permission without a name here is a compile error, so the
 * panel can never show a bare code again.
 */
export const PERMISSION_LABELS: Record<Permission, PermissionLabel> = {
  'emotive_claims.view': {
    nameSr: 'Vidi EMOTIVE reklamacije',
    nameEn: 'Sees EMOTIVE claims',
    descriptionSr: 'Spisak i pojedinačnu reklamaciju, za sve partnere.',
    descriptionEn: 'The list and any single claim, for every partner.',
  },
  'emotive_claims.view_own_customer': {
    nameSr: 'Vidi EMOTIVE reklamacije svoje firme',
    nameEn: "Sees own firm's EMOTIVE claims",
    descriptionSr:
      'Samo redove firme za koju je nalog vezan. Ovo drži klijent na portalu, ne čovek iz firme.',
    descriptionEn:
      'Only rows of the firm the account is linked to. This belongs to a portal client, not to staff.',
  },
  'emotive_claims.create': {
    nameSr: 'Otvara EMOTIVE reklamaciju',
    nameEn: 'Opens an EMOTIVE claim',
    descriptionSr: '',
    descriptionEn: '',
  },
  'emotive_claims.update': {
    nameSr: 'Menja EMOTIVE reklamaciju',
    nameEn: 'Edits an EMOTIVE claim',
    descriptionSr: 'Reklamacija je izmenjiva u svakom stanju; svaka izmena ide u Istoriju.',
    descriptionEn: 'A claim stays editable in every state; every change is recorded.',
  },
  'emotive_claims.delete': {
    nameSr: 'Briše EMOTIVE reklamaciju',
    nameEn: 'Deletes an EMOTIVE claim',
    descriptionSr: 'Meko brisanje — red ostaje i može da se vrati.',
    descriptionEn: 'A soft delete — the row stays and can be restored.',
  },
  'emotive_claims.restore': {
    nameSr: 'Vraća obrisanu EMOTIVE reklamaciju',
    nameEn: 'Restores a deleted EMOTIVE claim',
    descriptionSr: '',
    descriptionEn: '',
  },
  'emotive_claims.change_outcome': {
    nameSr: 'Odlučuje ishod EMOTIVE reklamacije',
    nameEn: "Decides an EMOTIVE claim's outcome",
    descriptionSr: 'Prihvaćeno, odbijeno, arhivirano ili nazad u obradu.',
    descriptionEn: 'Accepted, rejected, archived, or back to pending.',
  },
  'emotive_claims.publish': {
    nameSr: 'Objavljuje EMOTIVE reklamaciju klijentu',
    nameEn: 'Publishes an EMOTIVE claim to the client',
    descriptionSr: 'Do objave klijent na portalu ne vidi ni ishod ni datum završetka.',
    descriptionEn: 'Until it is published the client sees neither the outcome nor the finish date.',
  },
  'domace_claims.view': {
    nameSr: 'Vidi DOMACE reklamacije',
    nameEn: 'Sees DOMACE claims',
    descriptionSr: '',
    descriptionEn: '',
  },
  'domace_claims.view_own_customer': {
    nameSr: 'Vidi DOMACE reklamacije svoje firme',
    nameEn: "Sees own firm's DOMACE claims",
    descriptionSr: 'DOMACE reklamacije nemaju portal, pa ovo praktično ne otvara ništa.',
    descriptionEn: 'DOMACE claims have no portal, so this opens next to nothing.',
  },
  'domace_claims.create': {
    nameSr: 'Otvara DOMACE reklamaciju',
    nameEn: 'Opens a DOMACE claim',
    descriptionSr: '',
    descriptionEn: '',
  },
  'domace_claims.update': {
    nameSr: 'Menja DOMACE reklamaciju',
    nameEn: 'Edits a DOMACE claim',
    descriptionSr: 'Iznosi za popravku ostaju izmenjivi samo dok je ishod prihvaćeno.',
    descriptionEn: 'The repair amounts stay editable only while the outcome is accepted.',
  },
  'domace_claims.delete': {
    nameSr: 'Briše DOMACE reklamaciju',
    nameEn: 'Deletes a DOMACE claim',
    descriptionSr: 'Meko brisanje — red ostaje i može da se vrati.',
    descriptionEn: 'A soft delete — the row stays and can be restored.',
  },
  'domace_claims.restore': {
    nameSr: 'Vraća obrisanu DOMACE reklamaciju',
    nameEn: 'Restores a deleted DOMACE claim',
    descriptionSr: '',
    descriptionEn: '',
  },
  'domace_claims.change_outcome': {
    nameSr: 'Odlučuje ishod DOMACE reklamacije',
    nameEn: "Decides a DOMACE claim's outcome",
    descriptionSr: 'Prihvaćeno, odbijeno, arhivirano ili nazad u obradu.',
    descriptionEn: 'Accepted, rejected, archived, or back to pending.',
  },
  'attachments.view_internal': {
    nameSr: 'Vidi sve priloge',
    nameEn: 'Sees every attachment',
    descriptionSr: 'Uključujući one koji nisu označeni kao vidljivi klijentu.',
    descriptionEn: 'Including the ones not marked visible to the client.',
  },
  'attachments.upload': {
    nameSr: 'Kači prilog',
    nameEn: 'Uploads an attachment',
    descriptionSr: '',
    descriptionEn: '',
  },
  'attachments.delete_own': {
    nameSr: 'Briše prilog koji je sam okačio',
    nameEn: 'Deletes an attachment they uploaded',
    descriptionSr: '',
    descriptionEn: '',
  },
  'attachments.delete_any': {
    nameSr: 'Briše tuđi prilog',
    nameEn: "Deletes anyone's attachment",
    descriptionSr: '',
    descriptionEn: '',
  },
  'attachments.change_visibility': {
    nameSr: 'Određuje da li klijent vidi prilog',
    nameEn: 'Decides whether the client sees an attachment',
    descriptionSr: 'Važi za EMOTIVE reklamacije — samo one imaju portal.',
    descriptionEn: 'EMOTIVE claims only — they are the ones with a portal.',
  },
  'attachments.view_client_visible': {
    nameSr: 'Vidi priloge označene kao vidljive klijentu',
    nameEn: 'Sees attachments marked visible to the client',
    descriptionSr: 'Ovo drži klijent na portalu.',
    descriptionEn: 'This belongs to a portal client.',
  },
  'client_submissions.create': {
    nameSr: 'Šalje prijavu sa portala',
    nameEn: 'Sends a submission from the portal',
    descriptionSr: 'Radnja klijenta, ne zaposlenog.',
    descriptionEn: "A client's action, not a staff member's.",
  },
  'client_submissions.manage': {
    nameSr: 'Vodi Pristiglo',
    nameEn: 'Runs the Inbox',
    descriptionSr: 'Otvara prijave klijenata i pretvara ih u reklamacije.',
    descriptionEn: 'Opens client submissions and turns them into claims.',
  },
  'notifications.view_own': {
    nameSr: 'Ima zvonce sa obaveštenjima',
    nameEn: 'Has the notification bell',
    descriptionSr: 'Vidi i briše svoja obaveštenja. Bez ovoga zvonca nema.',
    descriptionEn: 'Sees and deletes their own notifications. Without it there is no bell.',
  },
  'intake_orders.view': {
    nameSr: 'Vidi sve naloge prijema',
    nameEn: 'Sees every intake order',
    descriptionSr: '',
    descriptionEn: '',
  },
  'intake_orders.view_own': {
    nameSr: 'Vidi svoje naloge prijema',
    nameEn: 'Sees their own intake orders',
    descriptionSr: 'Samo naloge na kojima je on serviser.',
    descriptionEn: 'Only the orders where they are the service technician.',
  },
  'intake_orders.create': {
    nameSr: 'Otvara nalog prijema',
    nameEn: 'Opens an intake order',
    descriptionSr: '',
    descriptionEn: '',
  },
  'intake_orders.update': {
    nameSr: 'Menja nalog prijema',
    nameEn: 'Edits an intake order',
    descriptionSr: 'Posle potpisa ostaju izmenjivi samo usluge, materijal i telefon.',
    descriptionEn: 'Once signed, only services, materials and the phone number stay editable.',
  },
  'intake_orders.advance': {
    nameSr: 'Pomera nalog kroz faze',
    nameEn: 'Moves an order through its stages',
    descriptionSr: 'Do „gotovo". Vozilo se izdaje na ekranu Primopredaja, ne ovim dugmetom.',
    descriptionEn: 'Up to "done". The vehicle is released on the Handover screen, not by this.',
  },
  'intake_orders.change_status': {
    nameSr: 'Ispravlja status naloga',
    nameEn: "Corrects an order's status",
    descriptionSr: 'Isti ključ otvara i izdavanje vozila bez potpisa.',
    descriptionEn: 'The same key also releases a vehicle without signatures.',
  },
  'intake_orders.delete': {
    nameSr: 'Briše nalog prijema',
    nameEn: 'Deletes an intake order',
    descriptionSr: 'Potpisan nalog se ne briše — on je firmina polovina vlasnikovog papira.',
    descriptionEn: "A signed order is never deleted — it is the shop's half of the owner's paper.",
  },
  'intake_orders.send_document': {
    nameSr: 'Šalje papir vlasniku na mejl',
    nameEn: 'Emails the document to the owner',
    descriptionSr: 'I nalog prijema i primopredaju, sa potpisima.',
    descriptionEn: 'Both the intake order and the handover, signatures included.',
  },
  'claim_reports.view': {
    nameSr: 'Vidi izveštaj reklamacije',
    nameEn: 'Sees the claim report',
    descriptionSr: '',
    descriptionEn: '',
  },
  'claim_reports.update': {
    nameSr: 'Piše izveštaj reklamacije',
    nameEn: 'Writes the claim report',
    descriptionSr: 'Izveštaj je ono što klijent na kraju dobije.',
    descriptionEn: 'The report is what the client is finally handed.',
  },
  'claim_reports.export': {
    nameSr: 'Izvozi izveštaj u PDF',
    nameEn: 'Exports the report to PDF',
    descriptionSr: '',
    descriptionEn: '',
  },
  'customers.view': {
    nameSr: 'Vidi firme',
    nameEn: 'Sees firms',
    descriptionSr: 'Bez ovoga su padajuće liste firmi u formama prazne.',
    descriptionEn: 'Without it the firm dropdowns in the forms come up empty.',
  },
  'customers.create': {
    nameSr: 'Dodaje firmu',
    nameEn: 'Adds a firm',
    descriptionSr: '',
    descriptionEn: '',
  },
  'customers.update': {
    nameSr: 'Menja firmu',
    nameEn: 'Edits a firm',
    descriptionSr: '',
    descriptionEn: '',
  },
  'customers.delete': {
    nameSr: 'Briše firmu',
    nameEn: 'Deletes a firm',
    descriptionSr: '',
    descriptionEn: '',
  },
  'customers.link_users': {
    nameSr: 'Vezuje nalog za firmu',
    nameEn: 'Links an account to a firm',
    descriptionSr: 'Ta veza je ono što klijentu na portalu otvara redove njegove firme.',
    descriptionEn: "That link is what opens a firm's rows to its client in the portal.",
  },
  'employees.view': {
    nameSr: 'Vidi radnike',
    nameEn: 'Sees workers',
    descriptionSr: 'Bez ovoga se zaduženi radnik i krivac za kvar ne mogu izabrati.',
    descriptionEn: 'Without it neither the assigned worker nor a fault owner can be picked.',
  },
  'employees.view_analytics': {
    nameSr: 'Vidi učinak radnika',
    nameEn: "Sees workers' performance",
    descriptionSr: 'Ko je koliko kvarova napravio — merenje imenovanih ljudi.',
    descriptionEn: 'Who caused how many faults — measuring named people.',
  },
  'employees.create': {
    nameSr: 'Dodaje radnika',
    nameEn: 'Adds a worker',
    descriptionSr: '',
    descriptionEn: '',
  },
  'employees.update': {
    nameSr: 'Menja radnika',
    nameEn: 'Edits a worker',
    descriptionSr: '',
    descriptionEn: '',
  },
  'employees.deactivate': {
    nameSr: 'Gasi radnika',
    nameEn: 'Deactivates a worker',
    descriptionSr: 'Još nije napravljeno — admin ekran radnika za sada samo briše.',
    descriptionEn: 'Not built yet — the worker screen only soft-deletes for now.',
  },
  'employees.delete': {
    nameSr: 'Briše radnika',
    nameEn: 'Deletes a worker',
    descriptionSr: '',
    descriptionEn: '',
  },
  'employee_output.view': {
    nameSr: 'Vidi mesečni broj sklopljenih motora',
    nameEn: 'Sees the monthly engines-assembled count',
    descriptionSr: 'Brojilac postoji, ali ga još niko ne puni.',
    descriptionEn: 'The counter exists, but nobody fills it in yet.',
  },
  'employee_output.update': {
    nameSr: 'Upisuje mesečni broj sklopljenih motora',
    nameEn: 'Records the monthly engines-assembled count',
    descriptionSr: 'Još nije napravljeno.',
    descriptionEn: 'Not built yet.',
  },
  'statistics.view_emotive': {
    nameSr: 'Vidi statistiku EMOTIVE reklamacija',
    nameEn: 'Sees EMOTIVE claim statistics',
    descriptionSr: '',
    descriptionEn: '',
  },
  'statistics.view_domace': {
    nameSr: 'Vidi statistiku DOMACE reklamacija',
    nameEn: 'Sees DOMACE claim statistics',
    descriptionSr: '',
    descriptionEn: '',
  },
  'statistics.view_overall': {
    nameSr: 'Vidi zbirnu statistiku',
    nameEn: 'Sees the combined statistics',
    descriptionSr: 'UKUPNO preko obe vrste reklamacija.',
    descriptionEn: 'UKUPNO across both kinds of claim.',
  },
  'statistics.view_financial': {
    nameSr: 'Vidi novac u statistici',
    nameEn: 'Sees the money in the statistics',
    descriptionSr: 'Iznosi popravki i njihov zbir. Bez ovoga statistika pokazuje samo brojeve.',
    descriptionEn: 'Repair amounts and their totals. Without it the statistics show counts only.',
  },
  'export.workbook_full': {
    nameSr: 'Izvozi celu Excel knjigu',
    nameEn: 'Exports the whole Excel workbook',
    descriptionSr: '',
    descriptionEn: '',
  },
  'export.workbook_partial': {
    nameSr: 'Izvozi izabrane listove',
    nameEn: 'Exports selected sheets',
    descriptionSr: '',
    descriptionEn: '',
  },
  'export.own_claims': {
    nameSr: 'Preuzima PDF svoje reklamacije',
    nameEn: 'Downloads the PDF of their own claim',
    descriptionSr: 'Radnja klijenta na portalu.',
    descriptionEn: "A portal client's action.",
  },
  'users.view': {
    nameSr: 'Vidi korisnike',
    nameEn: 'Sees users',
    descriptionSr: '',
    descriptionEn: '',
  },
  'users.create': {
    nameSr: 'Pravi nalog',
    nameEn: 'Creates an account',
    descriptionSr: 'Još nije napravljeno — nalozi stižu kroz prijavu i odobravanje.',
    descriptionEn: 'Not built yet — accounts arrive through registration and approval.',
  },
  'users.update': {
    nameSr: 'Menja podatke naloga',
    nameEn: 'Edits account details',
    descriptionSr: 'Još nije napravljeno.',
    descriptionEn: 'Not built yet.',
  },
  'users.deactivate': {
    nameSr: 'Gasi nalog',
    nameEn: 'Deactivates an account',
    descriptionSr: 'Prijava prestaje odmah, istorija ostaje.',
    descriptionEn: 'Sign-in stops at once, the history stays.',
  },
  'users.delete': {
    nameSr: 'Briše nalog',
    nameEn: 'Deletes an account',
    descriptionSr: '',
    descriptionEn: '',
  },
  'users.reset_password': {
    nameSr: 'Postavlja tuđu lozinku',
    nameEn: "Sets someone else's password",
    descriptionSr:
      'Postavlja je direktno, ne šalje link. Najkraći put do tuđeg naloga — zato ostaje samo kod admina.',
    descriptionEn:
      "Sets it directly, no email link. The shortest road into someone else's account — admin only.",
  },
  'users.approve_registration': {
    nameSr: 'Odobrava prijavu klijenta',
    nameEn: 'Approves a client registration',
    descriptionSr: 'Odobravanje dodeljuje rolu, dakle daje prava.',
    descriptionEn: 'Approving assigns a role, which means handing out rights.',
  },
  'users.reject_registration': {
    nameSr: 'Odbija prijavu klijenta',
    nameEn: 'Rejects a client registration',
    descriptionSr: '',
    descriptionEn: '',
  },
  'roles.view': {
    nameSr: 'Vidi ovlašćenja',
    nameEn: 'Sees permission sets',
    descriptionSr: '',
    descriptionEn: '',
  },
  'roles.create': {
    nameSr: 'Pravi ovlašćenje',
    nameEn: 'Creates a permission set',
    descriptionSr: '',
    descriptionEn: '',
  },
  'roles.update': {
    nameSr: 'Menja ovlašćenje',
    nameEn: 'Edits a permission set',
    descriptionSr: 'Izmena odmah gasi prijavu svima koji ga drže.',
    descriptionEn: 'A change signs out everyone holding it, immediately.',
  },
  'roles.delete': {
    nameSr: 'Briše ovlašćenje',
    nameEn: 'Deletes a permission set',
    descriptionSr: 'Ovlašćenje koje neko drži se ne briše.',
    descriptionEn: 'A set somebody holds cannot be deleted.',
  },
  'roles.assign': {
    nameSr: 'Dodeljuje ovlašćenja ljudima',
    nameEn: 'Assigns permission sets to people',
    descriptionSr: 'Ko ovo drži, određuje šta ostali smeju.',
    descriptionEn: 'Whoever holds this decides what everyone else may do.',
  },
  'settings.departments.manage': {
    nameSr: 'Vodi odeljenja',
    nameEn: 'Maintains departments',
    descriptionSr: 'Odeljenje je evidencija ko je gde u firmi — ono ne daje nikakva prava.',
    descriptionEn: 'A department records where someone works — it grants no rights at all.',
  },
  'settings.engine_types.manage': {
    nameSr: 'Vodi šifarnik tipova motora',
    nameEn: 'Maintains the engine-type list',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.engine_types.create': {
    nameSr: 'Dodaje tip motora u hodu',
    nameEn: 'Adds an engine type on the fly',
    descriptionSr: 'Da operater doda tip koji fali dok unosi reklamaciju, bez ulaska u šifarnik.',
    descriptionEn: 'So an operator can add a missing type while entering a claim.',
  },
  'settings.engine_manufacturers.manage': {
    nameSr: 'Vodi šifarnik proizvođača motora',
    nameEn: 'Maintains the engine-manufacturer list',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.engine_manufacturers.create': {
    nameSr: 'Dodaje proizvođača motora u hodu',
    nameEn: 'Adds an engine manufacturer on the fly',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.external_parties.create': {
    nameSr: 'Dodaje eksternog izvođača u hodu',
    nameEn: 'Adds an external party on the fly',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.external_parties.manage': {
    nameSr: 'Vodi šifarnik eksternih izvođača',
    nameEn: 'Maintains the external-party list',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.claim_sources.manage': {
    nameSr: 'Vodi šifarnik izvora reklamacija',
    nameEn: 'Maintains the claim-source list',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.intake_checklist.manage': {
    nameSr: 'Vodi ček-listu prijema',
    nameEn: 'Maintains the intake checklist',
    descriptionSr: 'Stavke koje serviser potvrđuje pri prijemu vozila.',
    descriptionEn: 'The items the technician confirms when a vehicle is taken in.',
  },
  'settings.intake_damage_types.manage': {
    nameSr: 'Vodi vrste oštećenja na prijemu',
    nameEn: 'Maintains the intake damage types',
    descriptionSr: 'Ekran za ovo još ne postoji.',
    descriptionEn: 'The screen for this does not exist yet.',
  },
  'settings.intake_arrival_modes.manage': {
    nameSr: 'Vodi načine dolaska vozila',
    nameEn: 'Maintains the vehicle arrival modes',
    descriptionSr: 'Ekran za ovo još ne postoji.',
    descriptionEn: 'The screen for this does not exist yet.',
  },
  'settings.app_settings.view': {
    nameSr: 'Vidi podešavanja aplikacije',
    nameEn: 'Sees the app settings',
    descriptionSr: '',
    descriptionEn: '',
  },
  'settings.app_settings.update': {
    nameSr: 'Menja podešavanja aplikacije',
    nameEn: 'Changes the app settings',
    descriptionSr: 'Telefon podrške, adrese za obaveštenja, mejl klijentu o ishodu.',
    descriptionEn: 'The support phone, the notification addresses, the outcome email.',
  },
  'settings.app_settings.manage_secrets': {
    nameSr: 'Menja tajna podešavanja',
    nameEn: 'Changes secret settings',
    descriptionSr: 'Ključevi i lozinke servisa. Nijedno podešavanje danas nije označeno kao tajno.',
    descriptionEn: 'Service keys and passwords. No setting is marked secret today.',
  },
  'audit.view': {
    nameSr: 'Vidi Istoriju',
    nameEn: 'Sees the history',
    descriptionSr: 'Ko je šta promenio, kada i sa koje adrese.',
    descriptionEn: 'Who changed what, when, and from which address.',
  },
  'audit.export': {
    nameSr: 'Izvozi Istoriju',
    nameEn: 'Exports the history',
    descriptionSr: 'Još nije napravljeno.',
    descriptionEn: 'Not built yet.',
  },
}
