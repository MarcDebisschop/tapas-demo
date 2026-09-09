// =============================================================================
// server/onthaal-contact-bewaartermijn.ts - Opruiming van de contactaanvragen
//
// Bevinding 15 uit het privacydossier: de vragen die via het contactformulier op
// de onthaalpagina binnenkomen, bevatten naam, e-mailadres, organisatie, rol en
// een vrij tekstveld waarin een bezoeker soms veel meer vertelt dan nodig. Die
// rijen stonden in de tabel `onthaal_contactaanvragen` zonder bewaartermijn: ze
// bleven staan zolang de databank bestond.
//
// Deze module trekt dezelfde lijn door als de opruiming van de afnames en van de
// aankoop-intakes: na twaalf maanden wordt de inhoud gewist. De rij zelf blijft,
// zonder persoonsgegevens, met enkel de vaststelling dat er ooit een vraag was,
// wanneer ze binnenkwam en wanneer ze gewist is. Dat is wat een verwerkings-
// register nodig heeft en niet meer.
//
// Eigenschappen, gelijk aan de andere opruimingen:
//   - Idempotent: een reeds gewiste rij wordt overgeslagen.
//   - Faalt zacht: bestaat de tabel niet, of heeft ze de kolommen van deze versie
//     nog niet, dan doet de functie niets.
// =============================================================================

import { sqlite } from "./storage";
import { schrijfAuditLog } from "./audit-log";

export const CONTACT_ANONIMISERINGSREDEN =
  "bewaartermijn contactaanvraag verstreken - automatisch";

/** Bestaat de tabel? Ze wordt pas aangemaakt bij het registreren van de route. */
function tabelBestaat(): boolean {
  const rij = sqlite
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'onthaal_contactaanvragen'`,
    )
    .get();
  return rij != null;
}

/** Heeft de tabel de bewaarkolommen van deze versie al? */
function heeftBewaarkolommen(): boolean {
  const namen = (
    sqlite.prepare(`PRAGMA table_info(onthaal_contactaanvragen)`).all() as Array<{ name: string }>
  ).map((k) => k.name);
  return namen.includes("bewaartot") && namen.includes("geanonimiseerd_op");
}

/** De ids van de aanvragen waarvan de bewaartermijn verstreken is. */
export function verstrekenContactaanvraagIds(nu = new Date()): number[] {
  if (!tabelBestaat() || !heeftBewaarkolommen()) return [];
  const rijen = sqlite
    .prepare(
      `SELECT id FROM onthaal_contactaanvragen
        WHERE bewaartot IS NOT NULL
          AND bewaartot < ?
          AND geanonimiseerd_op IS NULL
        ORDER BY id`,
    )
    .all(nu.toISOString()) as Array<{ id: number }>;
  return rijen.map((r) => r.id);
}

/**
 * Wist de inhoud van de verstreken aanvragen. Geeft het aantal opgeruimde rijen
 * terug zodat een test of een handmatige run het resultaat kan nakijken.
 */
export function ruimVerstrekenContactaanvragenOp(nu = new Date()): number {
  let ids: number[];
  try {
    ids = verstrekenContactaanvraagIds(nu);
  } catch (err) {
    console.error("[onthaal-contact] Kon verstreken aanvragen niet opzoeken:", err);
    return 0;
  }
  if (ids.length === 0) return 0;

  const tijdstip = nu.toISOString();
  let opgeruimd = 0;
  const stmt = sqlite.prepare(
    `UPDATE onthaal_contactaanvragen
        SET naam = '', organisatie = '', email = '', rol = '', vraag = '',
            toestemming_ip = NULL, mail_melding = '', geanonimiseerd_op = ?
      WHERE id = ?`,
  );
  for (const id of ids) {
    try {
      stmt.run(tijdstip, id);
      opgeruimd++;
    } catch (err) {
      console.error(`[onthaal-contact] Fout bij aanvraag #${id}:`, err);
    }
  }
  if (opgeruimd > 0) {
    // Aantoonbaarheid (AVG art. 5.2). De aanvraag hangt niet aan een afname, dus
    // het afnameveld blijft leeg en het aantal komt in de toelichting.
    schrijfAuditLog({
      adminId: null,
      actie: "contactaanvraag_anonimisering",
      afnameId: null,
      detail: `${opgeruimd} contactaanvraag(en) gewist - ${CONTACT_ANONIMISERINGSREDEN}`,
    });
    console.log(`[onthaal-contact] ${opgeruimd} verstreken contactaanvraag(en) gewist.`);
  }
  return opgeruimd;
}
