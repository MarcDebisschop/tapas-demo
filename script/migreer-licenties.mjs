#!/usr/bin/env node
/**
 * De overgangsperiode vastleggen.
 * ---------------------------------------------------------------------------
 *
 * `script/migreer-bekwaamheid.mjs` vult het register: wie er is. Dit script zet
 * de tweede stap: elke actieve geaccrediteerde krijgt één licentierij met status
 * `overgangsperiode`. Twee stappen en niet één, omdat ze verschillende dingen
 * doen. Het register beschrijft een feit dat al waar was. Een licentie is een
 * uitspraak over wat iemand mag, en zo'n uitspraak hoort niet als bijwerking van
 * een vulscript te ontstaan.
 *
 * Wat `overgangsperiode` betekent, in code: status `overgangsperiode`, geen
 * einddatum, geen agendadatum, geen alert. Die status staat in
 * `STATUSSEN_MET_AFNAMERECHT` (server/bekwaamheid/schema.ts) en blokkeert dus
 * niets. Op het moment van deze migratie verandert er voor niemand iets — dat is
 * de technische vorm van de belofte dat je vandaag niets verliest.
 *
 * Waarom één instrument en niet alle. `bekwaamheid_licenties.instrument_id` is
 * NOT NULL: een licentie zonder instrument bestaat niet in dit model. De vraag is
 * dus voor wélk instrument. Twee wegen zijn afgewogen:
 *
 *   • Afleiden uit `bekwaamheid_accreditaties`. Die tabel is leeg. Ze wordt door
 *     geen enkel script en geen enkele opslagfunctie gevuld — de docstring van
 *     `migreer-bekwaamheid.mjs` beweert van wel, en die bewering is onjuist.
 *     Een lege tabel als bron gebruiken levert nul licenties op.
 *   • Het instrument waarmee de cyclus begint. Dat is `t4p-business-kompas`,
 *     het canonieke id uit `server/registry.ts:315`.
 *
 * De tweede weg is gekozen. Dat is een bewuste beperking en geen volledigheid:
 * wie voor meer instrumenten bekwaam is, krijgt die licenties pas wanneer er een
 * bron is die dat vastlegt. Eén licentie per persoon aanmaken en de rest later
 * is eerlijker dan licenties verzinnen voor instrumenten waarvan niemand weet of
 * de persoon ze ooit heeft behaald.
 *
 * Eigenschappen:
 *   • Idempotent. `licenties.zetOvergangsperiode` geeft de bestaande rij terug
 *     wanneer die er is; twee keer draaien geeft hetzelfde resultaat.
 *   • Droogloop is de standaard. Zonder `--schrijf` verandert er niets.
 *   • Slaat inactieve geaccrediteerden over. Wie op `actief = 0` staat, krijgt
 *     geen afnamerecht.
 *
 * Gebruik:
 *   node script/migreer-licenties.mjs             # droogloop
 *   node script/migreer-licenties.mjs --schrijf
 *   node script/migreer-licenties.mjs --instrument t4o --schrijf
 *
 * Een andere databank kiezen gaat via `DATABASE_PAD` of `SQLITE_PAD`, exact
 * zoals bij `migreer-bekwaamheid.mjs`.
 */

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";

const vlaggen = process.argv.slice(2);
const SCHRIJF = vlaggen.includes("--schrijf");

/** Het instrument waarmee de licentiecyclus begint (server/registry.ts:315). */
export const STANDAARD_INSTRUMENT = "t4p-business-kompas";

const instrumentIndex = vlaggen.indexOf("--instrument");
const INSTRUMENT =
  instrumentIndex >= 0 && vlaggen[instrumentIndex + 1]
    ? vlaggen[instrumentIndex + 1]
    : STANDAARD_INSTRUMENT;

/**
 * Dezelfde padzoeker als `migreer-bekwaamheid.mjs`, met dezelfde
 * omgevingsvariabelen. Bewust letterlijk gelijk: twee migratiescripts die naar
 * verschillende variabelen kijken, is hoe je met `--schrijf` op de verkeerde
 * databank terechtkomt terwijl je denkt op een kopie te werken.
 */
function vindDatabasePad() {
  const uitOmgeving = process.env.DATABASE_PAD || process.env.SQLITE_PAD;
  if (uitOmgeving) return uitOmgeving;
  for (const kandidaat of ["data.db", "data/data.db", "tapas.db"]) {
    const volledig = path.resolve(process.cwd(), kandidaat);
    if (existsSync(volledig)) return volledig;
  }
  return path.resolve(process.cwd(), "data.db");
}

/**
 * De migratiestap zelf, los van het uitvoeren.
 *
 * Als functie geschreven en niet als losse regels, zodat een test hem op een
 * proefdatabank kan draaien. Een migratiestap die alleen via de opdrachtregel
 * op de echte databank te draaien is, is een migratiestap die nooit onder test
 * staat.
 */
export function legOvergangsperiodeVast({ db, instrumentId = STANDAARD_INSTRUMENT, schrijf = false }) {
  const teller = { nieuw: 0, bestond: 0, overgeslagen: 0 };
  const meldingen = [];

  const personen = db
    .prepare(
      `SELECT id, naam, actief FROM bekwaamheid_geaccrediteerden
       ORDER BY id`,
    )
    .all();

  const vind = db.prepare(
    `SELECT id, status FROM bekwaamheid_licenties
     WHERE geaccrediteerde_id = ? AND instrument_id = ?`,
  );
  const zetNeer = db.prepare(
    `INSERT INTO bekwaamheid_licenties
       (geaccrediteerde_id, instrument_id, status, geldig_van, geldig_tot, alert_actief, updated_at)
     VALUES (?, ?, 'overgangsperiode', ?, NULL, 0, ?)`,
  );

  const nu = new Date().toISOString();
  const vandaag = nu.slice(0, 10);

  class DroogloopKlaar extends Error {}

  const verwerk = db.transaction(() => {
    for (const p of personen) {
      if (!p.actief) {
        teller.overgeslagen += 1;
        meldingen.push(`overgeslagen #${String(p.id).padEnd(5)} ${p.naam}   (inactief)`);
        continue;
      }
      const bestaand = vind.get(p.id, instrumentId);
      if (bestaand) {
        teller.bestond += 1;
        continue;
      }
      zetNeer.run(p.id, instrumentId, vandaag, nu);
      teller.nieuw += 1;
      meldingen.push(`nieuw        #${String(p.id).padEnd(5)} ${p.naam}`);
    }
    if (!schrijf) throw new DroogloopKlaar();
  });

  try {
    verwerk();
  } catch (fout) {
    if (!(fout instanceof DroogloopKlaar)) throw fout;
  }

  return { teller, meldingen, instrumentId, aantalPersonen: personen.length };
}

// ---------------------------------------------------------------------------
// Uitvoeren vanaf de opdrachtregel
// ---------------------------------------------------------------------------

const rechtstreeksAangeroepen =
  process.argv[1] && process.argv[1].endsWith("migreer-licenties.mjs");

if (rechtstreeksAangeroepen) {
  const pad = vindDatabasePad();
  const db = new Database(pad);
  db.pragma("foreign_keys = ON");

  const bestaat = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get("bekwaamheid_licenties");
  if (!bestaat) {
    console.error(
      "  Tabel `bekwaamheid_licenties` bestaat niet. Draai eerst migratie 0006_bekwaamheid.sql.",
    );
    process.exit(1);
  }

  const uit = legOvergangsperiodeVast({ db, instrumentId: INSTRUMENT, schrijf: SCHRIJF });

  const kop = SCHRIJF ? "GESCHREVEN" : "DROOGLOOP — er is niets gewijzigd";
  console.log("");
  console.log(`  ${kop}`);
  console.log(`  databank        ${pad}`);
  console.log(`  instrument      ${uit.instrumentId}`);
  console.log(`  in register     ${uit.aantalPersonen}`);
  console.log(`  nieuw           ${uit.teller.nieuw}`);
  console.log(`  bestond al      ${uit.teller.bestond}`);
  console.log(`  overgeslagen    ${uit.teller.overgeslagen}   (inactief)`);
  console.log("");
  for (const m of uit.meldingen) console.log(`  ${m}`);
  console.log("");
  if (!SCHRIJF) console.log("  Draai opnieuw met --schrijf om dit vast te leggen.");
  console.log("");

  db.close();
}
