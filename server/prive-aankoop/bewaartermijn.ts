// =============================================================================
// server/prive-aankoop/bewaartermijn.ts - Opruiming van de aankoop-intakes
//
// De intake van een particuliere aankoop bevat naam, e-mailadres en eventueel
// adres van de koper, en bij een instrument voor minderjarigen ook de naam van
// het kind. Die gegevens stonden in de tabel `prive_aankoop` zonder enige
// bewaartermijn: ze bleven staan zolang de databank bestond.
//
// Deze module trekt dezelfde lijn door als de opruiming van de afnames: na de
// bewaartermijn wordt de inhoud van de intake gewist. De rij zelf blijft, want
// ze draagt de koppeling naar de betaling en de factuur, en die koppeling is
// boekhoudkundig nodig. De factuur houdt haar eigen, wettelijk verplichte
// termijn; deze intake is enkel de werkkopie.
//
// Eigenschappen, gelijk aan de opruiming van de afnames:
//   - Idempotent: een reeds geanonimiseerde rij wordt overgeslagen.
//   - Faalt zacht: ontbreekt de tabel (bijvoorbeeld in een test die de
//     aankoopflow niet laadt), dan doet de functie niets.
// =============================================================================

import { sqlite } from "../storage";
import { schrijfAuditLog } from "../audit-log";

export const PRIVE_ANONIMISERINGSREDEN = "bewaartermijn intake verstreken - automatisch";

/** Bestaat de tabel? De aankoopflow maakt ze pas aan bij het registreren van haar routes. */
function tabelBestaat(): boolean {
  const rij = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prive_aankoop'`)
    .get();
  return rij != null;
}

/** Heeft de tabel de kolommen van deze versie al? */
function heeftBewaarkolommen(): boolean {
  const kolommen = sqlite.prepare(`PRAGMA table_info(prive_aankoop)`).all() as Array<{ name: string }>;
  const namen = kolommen.map((k) => k.name);
  return namen.includes("bewaartot") && namen.includes("geanonimiseerd_op");
}

/** De ids van de intakes waarvan de bewaartermijn verstreken is. */
export function verstrekenIntakeIds(nu = new Date()): number[] {
  if (!tabelBestaat() || !heeftBewaarkolommen()) return [];
  const rijen = sqlite
    .prepare(
      `SELECT id FROM prive_aankoop
        WHERE bewaartot IS NOT NULL
          AND bewaartot < ?
          AND geanonimiseerd_op IS NULL
        ORDER BY id`,
    )
    .all(nu.toISOString()) as Array<{ id: number }>;
  return rijen.map((r) => r.id);
}

/**
 * Wist de inhoud van de verstreken intakes. Geeft het aantal opgeruimde rijen
 * terug zodat een test of een handmatige run het resultaat kan nakijken.
 */
export function ruimVerstrekenIntakesOp(nu = new Date()): number {
  let ids: number[];
  try {
    ids = verstrekenIntakeIds(nu);
  } catch (err) {
    console.error("[prive-aankoop] Kon verstreken intakes niet opzoeken:", err);
    return 0;
  }
  if (ids.length === 0) return 0;

  const tijdstip = nu.toISOString();
  // Wat overblijft is een lege huls: geen naam, geen e-mailadres, geen adres.
  // Enkel de vaststelling dat er ooit een intake was en wanneer ze gewist is.
  const leeg = JSON.stringify({ geanonimiseerd: true, reden: PRIVE_ANONIMISERINGSREDEN, op: tijdstip });
  let opgeruimd = 0;
  const stmt = sqlite.prepare(
    `UPDATE prive_aankoop SET intake = ?, consent_ip = NULL, geanonimiseerd_op = ? WHERE id = ?`,
  );
  for (const id of ids) {
    try {
      stmt.run(leeg, tijdstip, id);
      opgeruimd++;
    } catch (err) {
      console.error(`[prive-aankoop] Fout bij intake #${id}:`, err);
    }
  }
  if (opgeruimd > 0) {
    // Aantoonbaarheid (AVG art. 5.2). De intake hangt niet aan een afname, dus
    // het afnameveld blijft leeg en het aantal komt in de toelichting.
    schrijfAuditLog({
      adminId: null,
      actie: "prive_intake_anonimisering",
      afnameId: null,
      detail: `${opgeruimd} intake(s) gewist - ${PRIVE_ANONIMISERINGSREDEN}`,
    });
    console.log(`[prive-aankoop] ${opgeruimd} verstreken intake(s) gewist.`);
  }
  return opgeruimd;
}
