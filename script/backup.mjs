#!/usr/bin/env node
// ---------------------------------------------------------------------------
// script/backup.mjs
//
// Auditbevinding O-1 (hoog): "Geen bouwpijplijn, monitoring of back-upstrategie".
// De pijplijn en de monitoring zijn in de vorige ronde toegevoegd; dit is het
// derde deel. Er bestond geen enkele manier om een consistente kopie van de
// databank te nemen: de databank staat in WAL-modus, dus een simpele
// bestandskopie tijdens gebruik kan een half geschreven transactie bevatten.
//
// Dit script gebruikt de ingebouwde online-back-upvoorziening van SQLite. Die
// maakt een consistente kopie TERWIJL het platform draait, zonder de app stil te
// leggen en zonder dat gebruikers er iets van merken.
//
// GEBRUIK
//   node script/backup.mjs                      -> kopie in ./backups/
//   node script/backup.mjs --map /pad/naar/map  -> kopie in een eigen map
//   node script/backup.mjs --bewaar 14          -> houd 14 kopieën, ruim de rest op
//
// De kopie heet tapas-<datum>-<tijd>.db en wordt na het maken meteen nagekeken
// met een integriteitscontrole. Een kopie die de controle niet haalt, is geen
// back-up; het script eindigt dan met een foutcode zodat een geplande taak dat
// merkt.
//
// HERSTEL: zie docs/OPERATIE-backup-en-herstel.md
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";

function arg(naam, standaard) {
  const i = process.argv.indexOf(`--${naam}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : standaard;
}

const bronPad = resolve(arg("bron", process.env.TAPAS_DB_PAD ?? "data.db"));
const doelMap = resolve(arg("map", process.env.TAPAS_BACKUP_MAP ?? "backups"));
const bewaar = Number(arg("bewaar", process.env.TAPAS_BACKUP_BEWAAR ?? "14"));

if (!existsSync(bronPad)) {
  console.error(`FOUT: databank niet gevonden op ${bronPad}`);
  process.exit(1);
}
mkdirSync(doelMap, { recursive: true });

const nu = new Date();
const stempel =
  `${nu.getFullYear()}${String(nu.getMonth() + 1).padStart(2, "0")}${String(nu.getDate()).padStart(2, "0")}` +
  `-${String(nu.getHours()).padStart(2, "0")}${String(nu.getMinutes()).padStart(2, "0")}`;
const doelPad = join(doelMap, `tapas-${stempel}.db`);

const bron = new Database(bronPad, { readonly: true });
try {
  // Online back-up: consistente kopie terwijl de app draait.
  await bron.backup(doelPad);
} catch (e) {
  console.error(`FOUT bij het maken van de back-up: ${e?.message ?? e}`);
  process.exit(1);
} finally {
  bron.close();
}

// Controle: een back-up die niet leesbaar is, is geen back-up.
const kopie = new Database(doelPad, { readonly: true });
let uitslag = "onbekend";
let aantalAfnames = null;
try {
  uitslag = kopie.pragma("integrity_check", { simple: true });
  try {
    aantalAfnames = kopie.prepare("SELECT COUNT(*) AS n FROM afnames").get().n;
  } catch {
    // Tabel hoeft niet te bestaan in een lege databank.
  }
} finally {
  kopie.close();
}

// Het openen van de kopie laat lege WAL-hulpbestanden achter; die horen niet bij
// de back-up en worden opgeruimd zodat de map enkel echte kopieen bevat.
for (const rest of [`${doelPad}-wal`, `${doelPad}-shm`]) {
  try {
    if (existsSync(rest)) unlinkSync(rest);
  } catch {
    // Niet kunnen opruimen mag de back-up nooit ongeldig maken.
  }
}

const grootteMb = (statSync(doelPad).size / (1024 * 1024)).toFixed(2);
if (uitslag !== "ok") {
  console.error(`FOUT: integriteitscontrole van ${doelPad} gaf "${uitslag}".`);
  process.exit(1);
}
console.log(
  `Back-up OK: ${doelPad} (${grootteMb} MB)` +
    (aantalAfnames === null ? "" : `, ${aantalAfnames} afnames`),
);

// Opruimen: houd de nieuwste `bewaar` kopieën.
if (Number.isFinite(bewaar) && bewaar > 0) {
  const kopieen = readdirSync(doelMap)
    .filter((n) => /^tapas-\d{8}-\d{4}\.db$/.test(n))
    .sort()
    .reverse();
  for (const oud of kopieen.slice(bewaar)) {
    unlinkSync(join(doelMap, oud));
    console.log(`Opgeruimd: ${oud}`);
  }
}
