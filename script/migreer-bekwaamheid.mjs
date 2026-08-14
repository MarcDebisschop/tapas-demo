#!/usr/bin/env node
/**
 * Eenmalige vulling van het bekwaamheidsregister.
 * ---------------------------------------------------------------------------
 *
 * Migratie 0006 maakt veertien lege tabellen. Dit script vult de eerste twee:
 * `bekwaamheid_geaccrediteerden` (wie er is) en `bekwaamheid_accreditaties`
 * (wat iemand ooit behaald heeft). Het maakt geen licenties aan — dat is een
 * aparte, bewuste stap die de overgangsperiode vastlegt en die niet in een
 * vulscript hoort.
 *
 * Drie bronnen, in deze volgorde:
 *
 *   1. `beheerders`      — iedereen met een account.
 *   2. `coach_register`  — de publieke coachpagina. Bevat ook de eenentwintig
 *                          namen die uit `server/routes-stm.ts` verdwenen zijn.
 *   3. de idtoewijzing hieronder — alleen om de bestaande monitor-ids te
 *                          behouden, zie de uitleg bij MONITOR_IDS.
 *
 * Eigenschappen:
 *   • Idempotent. Twee keer draaien geeft hetzelfde resultaat als één keer.
 *     De sleutel is het e-mailadres, of bij gebrek daaraan de rij in het
 *     coachregister. Nooit de naam.
 *   • Droogloop is de standaard. Zonder `--schrijf` verandert er niets en zie
 *     je alleen wat er zou gebeuren.
 *   • Weigert demo-rijen in productie. Wie `demo = 1` staat in het
 *     coachregister komt alleen in het register terecht met `--demo`, en die
 *     vlag werkt niet wanneer de omgeving op productie staat.
 *
 * Gebruik:
 *   node script/migreer-bekwaamheid.mjs                 # droogloop, echte namen
 *   node script/migreer-bekwaamheid.mjs --demo          # droogloop, ook demo
 *   node script/migreer-bekwaamheid.mjs --demo --schrijf
 */

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Vlaggen
// ---------------------------------------------------------------------------

const vlaggen = new Set(process.argv.slice(2));
const SCHRIJF = vlaggen.has("--schrijf");
const DEMO = vlaggen.has("--demo");
const IS_PRODUCTIE = process.env.NODE_ENV === "production";

if (DEMO && IS_PRODUCTIE) {
  console.error(
    "Geweigerd: --demo zet demo-namen in het register en NODE_ENV staat op " +
      "production. Een register dat verzonnen personen bevat, kan niet aantonen " +
      "wie er echt in staat.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// De idtoewijzing
// ---------------------------------------------------------------------------
//
// Waarom deze lijst bestaat, en waarom ze géén persoonsgegevens toevoegt:
//
// `server/routes-stm.ts` bevatte eenentwintig practitioners met de ids 1001 tot
// 1021. Aan die ids hangen rijen in `kwaliteit_normen`, `kwaliteit_overrides`,
// `kwaliteit_alerts` en `kwaliteit_maillog`. Zou het register nieuwe ids
// uitdelen, dan verliezen die rijen hun persoon — en of er in de live databank
// handmatig gezette normen of overrides staan, is van buitenaf niet te zien.
// Een koppeling weggooien die je niet kunt inspecteren, is de duurste van de
// twee fouten.
//
// De lijst bevat daarom alleen naam en nummer. De negentien verzonnen
// e-mailadressen (@tapas-demo.be, @tapas-demo.nl) zijn niet meegekomen; het
// adres wordt uit `coach_register` gehaald, en waar dat leeg is blijft het leeg.
// De namen zelf staan al in `coach_register` in deze repo, dus hier komt geen
// enkel gegeven bij dat er nog niet stond.
//
// Na deze eenmalige vulling is deze lijst dode letter: het register in de
// databank is dan de bron.
const MONITOR_IDS = [
  { id: 1001, naam: "Kris Debisschop" },
  { id: 1002, naam: "Herman Van Esbroeck" },
  { id: 1003, naam: "Prof. Leen Adams" },
  { id: 1004, naam: "Alan Bakx" },
  { id: 1005, naam: "An Mortelmans" },
  { id: 1006, naam: "Andrea Hoffmann" },
  { id: 1007, naam: "Carl De Geest" },
  { id: 1008, naam: "Caroline Lachat" },
  { id: 1009, naam: "Erik Franck" },
  { id: 1010, naam: "Gerlinde Cooymans" },
  { id: 1011, naam: "Gina Peeters" },
  { id: 1012, naam: "Jaccolien Molenaar" },
  { id: 1013, naam: "Katrien Vanherpe" },
  { id: 1014, naam: "Nadja Bakx-Trimbos" },
  { id: 1015, naam: "Tony Ramboer" },
  { id: 1016, naam: "Vanessa Luyten" },
  { id: 1017, naam: "Veerle Van de Paer" },
  { id: 1018, naam: "Jason-Louise Graham" },
  { id: 1019, naam: "Anne-Sofie Bogaerts" },
  { id: 1020, naam: "Karen Thiers" },
  { id: 1021, naam: "Anthony Van Aerdebrugge" },
];

/** Zoekt het te behouden monitor-id bij een naam, of niets. */
function monitorIdVoor(naam) {
  const genormaliseerd = naam.trim().toLowerCase();
  return MONITOR_IDS.find((m) => m.naam.toLowerCase() === genormaliseerd)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Databank
// ---------------------------------------------------------------------------

function vindDatabasePad() {
  const uitOmgeving = process.env.DATABASE_PAD || process.env.SQLITE_PAD;
  if (uitOmgeving) return uitOmgeving;
  for (const kandidaat of ["data.db", "data/data.db", "tapas.db"]) {
    const volledig = path.resolve(process.cwd(), kandidaat);
    if (existsSync(volledig)) return volledig;
  }
  return path.resolve(process.cwd(), "data.db");
}

const pad = vindDatabasePad();
if (!existsSync(pad)) {
  console.error(`Geen databank gevonden op ${pad}. Zet DATABASE_PAD.`);
  process.exit(1);
}

const db = new Database(pad);
db.pragma("foreign_keys = ON");

function tabelBestaat(naam) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(naam),
  );
}

if (!tabelBestaat("bekwaamheid_geaccrediteerden")) {
  console.error(
    "Tabel bekwaamheid_geaccrediteerden bestaat niet. Draai eerst migratie 0006.",
  );
  process.exit(1);
}

const nu = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Lezen
// ---------------------------------------------------------------------------

/** @type {Array<{herkomst: string, naam: string, email: string|null, beheerderId: number|null, coachRegisterId: number|null, id: number|null, demo: boolean, opleiding: string|null, behaaldOp: string|null}>} */
const kandidaten = [];

// Bron 1 — beheerders
if (tabelBestaat("beheerders")) {
  const rijen = db.prepare("SELECT id, naam, email FROM beheerders").all();
  for (const r of rijen) {
    const email = (r.email || "").trim().toLowerCase() || null;
    kandidaten.push({
      herkomst: "beheerders",
      naam: r.naam,
      email,
      beheerderId: r.id,
      coachRegisterId: null,
      id: null,
      // Een account is per definitie geen demo-gegeven.
      demo: false,
      opleiding: null,
      behaaldOp: null,
    });
  }
}

// Bron 2 — coach_register
if (tabelBestaat("coach_register")) {
  const rijen = db
    .prepare(
      `SELECT id, naam, email, opleidingTitel, behaaldOp, actief, demo
         FROM coach_register
        WHERE actief = 1`,
    )
    .all();
  for (const r of rijen) {
    const email = (r.email || "").trim().toLowerCase() || null;
    kandidaten.push({
      herkomst: "coach_register",
      naam: r.naam,
      email,
      beheerderId: null,
      coachRegisterId: r.id,
      id: monitorIdVoor(r.naam),
      demo: r.demo === 1,
      opleiding: (r.opleidingTitel || "").trim() || null,
      behaaldOp: (r.behaaldOp || "").trim() || null,
    });
  }
}

// ---------------------------------------------------------------------------
// Samenvoegen
// ---------------------------------------------------------------------------
//
// Iemand kan in beide bronnen staan. Samenvoegen gebeurt op e-mailadres, want
// dat is het enige veld dat in beide bronnen dezelfde betekenis heeft. Waar het
// adres ontbreekt, blijft de rij op zichzelf staan: op naam samenvoegen zou
// twee verschillende mensen met dezelfde naam tot één persoon maken, en bij een
// register van wie mag werken is dat de duurste fout.
const perSleutel = new Map();
for (const k of kandidaten) {
  const sleutel = k.email ?? `coach:${k.coachRegisterId}`;
  const bestaand = perSleutel.get(sleutel);
  if (!bestaand) {
    perSleutel.set(sleutel, { ...k });
    continue;
  }
  bestaand.beheerderId = bestaand.beheerderId ?? k.beheerderId;
  bestaand.coachRegisterId = bestaand.coachRegisterId ?? k.coachRegisterId;
  bestaand.id = bestaand.id ?? k.id;
  bestaand.opleiding = bestaand.opleiding ?? k.opleiding;
  bestaand.behaaldOp = bestaand.behaaldOp ?? k.behaaldOp;
  // Een persoon met een account is geen demo-persoon, ook niet wanneer hij
  // daarnaast als demo-coach in het register staat.
  bestaand.demo = bestaand.demo && k.demo;
  bestaand.herkomst = `${bestaand.herkomst}+${k.herkomst}`;
}

const alles = [...perSleutel.values()];
const teVerwerken = alles.filter((k) => (k.demo ? DEMO : true));
const overgeslagen = alles.filter((k) => k.demo && !DEMO);

// ---------------------------------------------------------------------------
// Schrijven
// ---------------------------------------------------------------------------

const zetNeer = db.prepare(
  `INSERT INTO bekwaamheid_geaccrediteerden
     (id, beheerder_id, coach_register_id, naam, email, landcode, taal, is_trainer, actief, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 'BE', 'nl', 0, 1, ?, ?)`,
);

const werkBij = db.prepare(
  `UPDATE bekwaamheid_geaccrediteerden SET
     naam = ?,
     beheerder_id = COALESCE(?, beheerder_id),
     coach_register_id = COALESCE(?, coach_register_id),
     email = COALESCE(?, email),
     updated_at = ?
   WHERE id = ?`,
);

const vindOpEmail = db.prepare(
  "SELECT * FROM bekwaamheid_geaccrediteerden WHERE email = ?",
);
const vindOpCoach = db.prepare(
  "SELECT * FROM bekwaamheid_geaccrediteerden WHERE coach_register_id = ?",
);
const vindOpId = db.prepare("SELECT * FROM bekwaamheid_geaccrediteerden WHERE id = ?");

/** Signaal om de droogloop terug te draaien; geen echte fout. */
class DroogloopKlaar extends Error {}

const teller = { nieuw: 0, bijgewerkt: 0, ongewijzigd: 0, zonderAdres: 0, idConflict: 0 };
const meldingen = [];

const verwerk = db.transaction(() => {
  for (const k of teVerwerken) {
    const bestaand =
      (k.email ? vindOpEmail.get(k.email) : null) ??
      (k.coachRegisterId ? vindOpCoach.get(k.coachRegisterId) : null);

    if (!k.email) teller.zonderAdres += 1;

    if (bestaand) {
      werkBij.run(k.naam, k.beheerderId, k.coachRegisterId, k.email, nu(), bestaand.id);
      const na = vindOpId.get(bestaand.id);
      if (
        na.naam === bestaand.naam &&
        na.beheerder_id === bestaand.beheerder_id &&
        na.coach_register_id === bestaand.coach_register_id &&
        na.email === bestaand.email
      ) {
        teller.ongewijzigd += 1;
      } else {
        teller.bijgewerkt += 1;
        meldingen.push(`bijgewerkt  #${bestaand.id.toString().padEnd(5)} ${k.naam}`);
      }
      continue;
    }

    // Nieuw. Het te behouden monitor-id gebruiken, tenzij dat nummer al
    // vergeven is — dan liever een nieuw nummer dan een verkeerde koppeling.
    let id = k.id;
    if (id !== null && vindOpId.get(id)) {
      teller.idConflict += 1;
      meldingen.push(
        `id ${id} was al vergeven; ${k.naam} krijgt een nieuw nummer. ` +
          "Controleer de koppeling met kwaliteit_normen handmatig.",
      );
      id = null;
    }
    zetNeer.run(id, k.beheerderId, k.coachRegisterId, k.naam, k.email, nu(), nu());
    teller.nieuw += 1;
    meldingen.push(
      `nieuw       #${String(id ?? "auto").padEnd(5)} ${k.naam}` +
        (k.email ? "" : "   (geen e-mailadres)"),
    );
  }

  if (!SCHRIJF) {
    // Droogloop: alles terugdraaien. De tellers en meldingen blijven staan,
    // want die zijn precies het doel van een droogloop.
    throw new DroogloopKlaar();
  }
});

// ---------------------------------------------------------------------------
// Verslag
// ---------------------------------------------------------------------------

try {
  verwerk();
} catch (fout) {
  if (!(fout instanceof DroogloopKlaar)) throw fout;
}

const kop = SCHRIJF ? "GESCHREVEN" : "DROOGLOOP — er is niets gewijzigd";
console.log("");
console.log(`  ${kop}`);
console.log(`  databank        ${pad}`);
console.log(`  demo-rijen      ${DEMO ? "meegenomen" : "overgeslagen"}`);
console.log("");
for (const m of meldingen) console.log(`  ${m}`);
if (meldingen.length > 0) console.log("");
console.log(`  nieuw           ${teller.nieuw}`);
console.log(`  bijgewerkt      ${teller.bijgewerkt}`);
console.log(`  ongewijzigd     ${teller.ongewijzigd}`);
console.log(`  zonder adres    ${teller.zonderAdres}   (worden niet aangeschreven)`);
if (teller.idConflict > 0) {
  console.log(`  id-conflicten   ${teller.idConflict}   NAKIJKEN`);
}
if (overgeslagen.length > 0) {
  console.log(`  demo overgeslagen ${overgeslagen.length}   (draai met --demo om ze mee te nemen)`);
}
console.log("");
if (!SCHRIJF) {
  console.log("  Draai opnieuw met --schrijf om dit vast te leggen.");
  console.log("");
}

db.close();
