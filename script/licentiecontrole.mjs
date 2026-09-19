#!/usr/bin/env node
// ---------------------------------------------------------------------------
// script/licentiecontrole.mjs
//
// Auditbevinding L-1 (hoog): er zat een GPL-3.0-component in de serverbundel. Die
// is vervangen door eigen code. De audit beveelt daarnaast uitdrukkelijk aan om
// "een licentiecontrole op te nemen in de bouwpijplijn zodat dit niet opnieuw kan
// ontstaan". Dat doet dit script.
//
// Het leest de licentie van elk geinstalleerd pakket uit node_modules en faalt
// zodra er een sterk copyleft-licentie (GPL, AGPL, SSPL, ...) in de keten zit.
// Ontwikkelafhankelijkheden die enkel bouwen en testen, zijn even relevant zolang
// het bouwscript met bundelen werkt: wat in de bundel belandt, wordt meegeleverd.
//
// GEBRUIK
//   node script/licentiecontrole.mjs            -> faalt bij een verboden licentie
//   node script/licentiecontrole.mjs --lijst     -> toont de volledige verdeling
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// Sterk copyleft: verplicht bij distributie mogelijk het vrijgeven van de
// volledige broncode onder dezelfde voorwaarden. Voor een platform waarvan de
// vermogensrechten het kernactivum zijn, is dat een materieel risico.
const VERBODEN = [/\bAGPL/i, /\bGPL-[23]/i, /\bGPL\b(?!.*LGPL)/i, /\bSSPL/i, /\bOSL\b/i, /\bEUPL/i];

// Permissieve licenties. Deze lijst dient enkel om een keuzelicentie te kunnen
// lezen: staat er "(MIT OR GPL-3.0-or-later)", dan geeft de uitgever de gebruiker
// zelf de keuze en kiest dit huis MIT. Dat is geen uitzondering en geen
// gedoogbeleid, dat is de licentie volgen zoals zij bedoeld is. SPDX noemt dit
// een keuze-uitdrukking met OR.
const PERMISSIEF = [
  /^MIT$/i,
  /^ISC$/i,
  /^BSD-[23]-Clause$/i,
  /^0BSD$/i,
  /^Apache-2\.0$/i,
  /^Unlicense$/i,
  /^CC0-1\.0$/i,
  /^Python-2\.0$/i,
  /^BlueOak-1\.0\.0$/i,
];

/**
 * Leest een keuzelicentie. Bevat de uitdrukking OR en is minstens een van de
 * keuzes permissief, dan geeft deze functie die keuze terug. In alle andere
 * gevallen null, en dan geldt de uitdrukking onverkort zoals ze er staat.
 *
 * Alleen OR levert een keuze. Bij AND gelden alle voorwaarden samen en helpt
 * een permissief deel niet.
 */
function permissieveKeuze(uitdrukking) {
  if (!/\bOR\b/i.test(uitdrukking) || /\bAND\b/i.test(uitdrukking)) return null;
  const keuzes = uitdrukking
    .replace(/[()]/g, " ")
    .split(/\bOR\b/i)
    .map((k) => k.trim())
    .filter(Boolean);
  return keuzes.find((k) => PERMISSIEF.some((r) => r.test(k))) ?? null;
}

// Uitzonderingen die na beoordeling toegelaten zijn. Elke regel hoort een reden te
// hebben; een lege lijst is het doel.
const UITZONDERINGEN = new Map([
  // ["pakketnaam", "reden en datum van de beoordeling"],
]);

const wortel = resolve(process.argv[2] ?? ".");
const modules = join(wortel, "node_modules");
if (!existsSync(modules)) {
  console.error("FOUT: node_modules niet gevonden. Voer eerst `npm ci` uit.");
  process.exit(1);
}

function licentieVan(pad) {
  try {
    const p = JSON.parse(readFileSync(join(pad, "package.json"), "utf8"));
    if (typeof p.license === "string") return p.license;
    if (p.license && typeof p.license.type === "string") return p.license.type;
    if (Array.isArray(p.licenses)) return p.licenses.map((l) => l.type ?? l).join(" OR ");
    return "ONBEKEND";
  } catch {
    return null;
  }
}

function* pakketten(map) {
  for (const naam of readdirSync(map)) {
    if (naam === ".bin" || naam === ".package-lock.json") continue;
    const pad = join(map, naam);
    if (naam.startsWith("@")) {
      try {
        for (const sub of readdirSync(pad)) yield [`${naam}/${sub}`, join(pad, sub)];
      } catch {
        // Geen map: overslaan.
      }
      continue;
    }
    yield [naam, pad];
  }
}

const verdeling = new Map();
const treffers = [];
const keuzes = [];
let bekeken = 0;

for (const [naam, pad] of pakketten(modules)) {
  const licentie = licentieVan(pad);
  if (licentie === null) continue;
  bekeken += 1;
  verdeling.set(licentie, (verdeling.get(licentie) ?? 0) + 1);
  if (VERBODEN.some((r) => r.test(licentie)) && !UITZONDERINGEN.has(naam)) {
    const keuze = permissieveKeuze(licentie);
    if (keuze) {
      keuzes.push({ naam, licentie, keuze });
    } else {
      treffers.push({ naam, licentie });
    }
  }
}

console.log(`Licentiecontrole: ${bekeken} pakketten bekeken.`);

if (keuzes.length > 0) {
  console.log("");
  console.log("Keuzelicenties: het permissieve deel geldt, de rest van de keuze valt weg.");
  for (const k of keuzes) console.log(`  ${k.naam}: ${k.licentie} -> ${k.keuze}`);
}

if (process.argv.includes("--lijst")) {
  for (const [licentie, aantal] of [...verdeling.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(aantal).padStart(4)}  ${licentie}`);
  }
}

if (treffers.length > 0) {
  console.error("");
  console.error("FOUT: sterk copyleft aangetroffen in de afhankelijkheidsketen:");
  for (const t of treffers) console.error(`  ${t.naam}: ${t.licentie}`);
  console.error("");
  console.error(
    "Vervang het pakket door een permissief alternatief of door eigen code. " +
      "Is het na juridische beoordeling toch aanvaardbaar, voeg het dan met reden " +
      "toe aan UITZONDERINGEN in script/licentiecontrole.mjs.",
  );
  process.exit(1);
}

console.log("Geen sterk copyleft in de keten.");
