// ---------------------------------------------------------------------------
// TaPas Platform — Aanmeldlink voor deelnemers (magic link).
//
// WAAROM DIT BESTAND BESTAAT
// server/routes-deelnemer.ts riep al `storage.maakMagicLink()` en
// `storage.wisselMagicLink()` aan, maar die twee functies bestonden nergens.
// De typecontrole meldde dat ook (TS2339, twee meldingen). Gevolg: de route
// /api/deelnemers/magic-link liep bij elke aanvraag stuk, en de enige weg naar
// het persoonlijke dashboard was /api/deelnemers/login — een route die het
// dashboardToken teruggeeft zodra iemand een e-mailadres intikt, zonder enige
// controle dat die persoon dat adres ook bezit.
//
// Dit bestand maakt de aanmeldlink echt. Zo kan de deelnemersdeur langs de
// veilige weg lopen in plaats van langs de open weg.
//
// STRIKTE WERKREGELS
// - Regel 1: niets herbouwen. De bestaande routes, de bestaande tabel
//   `deelnemers` en de bestaande /magic/:token-pagina blijven ongewijzigd;
//   hier komen alleen de twee ontbrekende functies bij.
// - Regel 2: de nieuwe tabel staat in DIT aparte bestand en wordt lui
//   aangemaakt met CREATE TABLE IF NOT EXISTS — hetzelfde huispatroon als
//   server/routes-coach-contact.ts en server/gids-manager.ts. Geen migratie,
//   geen wijziging aan shared/schema.ts, geen risico voor bestaande gegevens.
//
// VEILIGHEIDSEIGENSCHAPPEN
//   1. Geen account aanmaken. `maakMagicLink` zoekt een BESTAANDE deelnemer op
//      en geeft null terug bij een onbekend adres. Alleen wie al een plaats in
//      het platform heeft, kan een link krijgen.
//   2. Onraadbaar token: 32 willekeurige bytes uit crypto.randomBytes,
//      hexadecimaal (64 tekens).
//   3. Kort geldig: 15 minuten (LINK_GELDIG_MIN).
//   4. Eenmalig: bij het inwisselen wordt `gebruikt_op` gezet. Een tweede
//      poging met hetzelfde token faalt.
//   5. Vergelijking in constante tijd bij het opzoeken van het token
//      (timingSafeEqual), zodat de responstijd niets verklapt.
//   6. Opruiming: verlopen en gebruikte rijen ouder dan een dag worden bij elke
//      aanvraag opgeruimd, zodat de tabel niet blijft groeien.
//   7. Geen bevestiging of een adres bestaat: de route geeft altijd 200 terug.
//      Dat gebeurt in routes-deelnemer.ts en blijft daar.
// ---------------------------------------------------------------------------

import { randomBytes, timingSafeEqual } from "node:crypto";
import { sqlite as sqliteInstance } from "./storage";
import { storage } from "./storage";
import type { Deelnemer } from "@shared/schema";

// Hoe lang een aanmeldlink geldig blijft, in minuten.
export const LINK_GELDIG_MIN = 15;

// Hoe lang gebruikte of verlopen rijen bewaard blijven, in uren.
const OPRUIM_NA_UUR = 24;

const TABEL = "deelnemer_magic_links";

let tabelKlaar = false;

function getSqlite(): any {
  return sqliteInstance ?? null;
}

// Maakt de tabel aan in de meegegeven databank. Idempotent.
// Staat apart zodat een test ze in een geheugendatabank kan aanmaken.
export function maakTabel(sq: any): void {
  if (!sq) return;
  sq.exec(`
    CREATE TABLE IF NOT EXISTS ${TABEL} (
      token TEXT PRIMARY KEY,
      deelnemer_email TEXT NOT NULL,
      verloopt_op TEXT NOT NULL,
      gebruikt_op TEXT,
      aangemaakt_op TEXT NOT NULL
    )
  `);
  sq.exec(
    `CREATE INDEX IF NOT EXISTS idx_${TABEL}_email ON ${TABEL} (deelnemer_email)`,
  );
}

// De singleton-variant: maakt de tabel één keer aan in de databank van de app.
function zorgVoorTabel(): any {
  const sq = getSqlite();
  if (!sq) return null;
  if (!tabelKlaar) {
    maakTabel(sq);
    tabelKlaar = true;
  }
  return sq;
}

// Ruimt rijen op die al gebruikt of verlopen zijn en ouder dan OPRUIM_NA_UUR.
function ruimOp(sq: any): void {
  const grens = new Date(Date.now() - OPRUIM_NA_UUR * 3600 * 1000).toISOString();
  sq.prepare(`DELETE FROM ${TABEL} WHERE aangemaakt_op < ?`).run(grens);
}

// Vergelijkt twee tokens in constante tijd. Verschillende lengte is meteen
// onwaar; dat verklapt niets, want de lengte staat vast op 64 tekens.
function gelijkInConstanteTijd(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type MagicLinkResultaat = {
  token: string;
  verlooptOp: string;
};

// ---------------------------------------------------------------------------
// De twee kernbewerkingen op de tabel, met de databank als argument. Zo is het
// gedrag — geldigheidsduur, eenmalig gebruik, tokenvorm — toetsbaar zonder de
// databank van de app aan te raken (zelfde patroon als
// server/bekwaamheid/storage.ts).
// ---------------------------------------------------------------------------

// Schrijf een nieuw token weg voor een e-mailadres dat al gecontroleerd is.
export function bewaarToken(sq: any, email: string, nu = new Date()): MagicLinkResultaat {
  const token = randomBytes(32).toString("hex");
  const verlooptOp = new Date(nu.getTime() + LINK_GELDIG_MIN * 60 * 1000).toISOString();
  sq.prepare(
    `INSERT INTO ${TABEL} (token, deelnemer_email, verloopt_op, gebruikt_op, aangemaakt_op)
     VALUES (?, ?, ?, NULL, ?)`,
  ).run(token, email, verlooptOp, nu.toISOString());
  return { token, verlooptOp };
}

// Zoek een token op en markeer het meteen als gebruikt. Geeft het e-mailadres
// terug bij een geldig, ongebruikt en niet-verlopen token; anders null.
export function gebruikToken(sq: any, token: string, nu = new Date()): string | null {
  const t = (token ?? "").trim();
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return null;

  const rij = sq
    .prepare(
      `SELECT token, deelnemer_email, verloopt_op, gebruikt_op FROM ${TABEL} WHERE token = ?`,
    )
    .get(t) as
    | { token: string; deelnemer_email: string; verloopt_op: string; gebruikt_op: string | null }
    | undefined;

  if (!rij) return null;
  if (!gelijkInConstanteTijd(rij.token, t)) return null;
  if (rij.gebruikt_op) return null;
  if (new Date(rij.verloopt_op).getTime() <= nu.getTime()) return null;

  // Eenmalig gebruik: markeer meteen, en alleen wanneer de rij nog vrij is.
  const gemarkeerd = sq
    .prepare(`UPDATE ${TABEL} SET gebruikt_op = ? WHERE token = ? AND gebruikt_op IS NULL`)
    .run(nu.toISOString(), t);
  if (!gemarkeerd || gemarkeerd.changes !== 1) return null;

  return rij.deelnemer_email;
}

// ---------------------------------------------------------------------------
// Vraag een aanmeldlink aan voor een BESTAANDE deelnemer.
// Geeft null terug wanneer het adres onbekend is — er wordt nooit een account
// aangemaakt en er wordt nooit iets teruggegeven waarmee je dat kunt aflezen.
// ---------------------------------------------------------------------------
export async function maakMagicLink(email: string): Promise<MagicLinkResultaat | null> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;

  const deelnemer = await storage.getDeelnemerByEmail(e);
  if (!deelnemer) return null;

  const sq = zorgVoorTabel();
  if (!sq) return null;
  ruimOp(sq);

  return bewaarToken(sq, deelnemer.email);
}

// ---------------------------------------------------------------------------
// Wissel een aanmeldlink in. Geeft de deelnemer terug bij een geldig, ongebruikt
// en niet-verlopen token; in alle andere gevallen undefined.
// Het token wordt onmiddellijk als gebruikt gemarkeerd (eenmalig gebruik).
// ---------------------------------------------------------------------------
export async function wisselMagicLink(token: string): Promise<Deelnemer | undefined> {
  const sq = zorgVoorTabel();
  if (!sq) return undefined;

  const email = gebruikToken(sq, token);
  if (!email) return undefined;

  return await storage.getDeelnemerByEmail(email);
}
