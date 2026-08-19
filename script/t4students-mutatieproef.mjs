#!/usr/bin/env node
/**
 * Mutatieproef op de wachttoetsen van T4Students.
 *
 * Waarom dit bestaat
 * ------------------
 * Groene toetsen bewijzen niets. Een wachttoets is pas iets waard als hij rood
 * wordt zodra iemand de keten van invulscherm tot PDF losmaakt. Dit schriptje
 * maakt die keten een voor een bewust stuk, draait telkens de bijhorende
 * wachttoets, en zet daarna alles weer terug zoals het was.
 *
 * Verwachte uitslag: de nulmeting is groen, elke mutatie is rood.
 * Staat er ook maar een mutatie op GEMIST, dan is de bewaking lek en mag er
 * niet vrijgegeven worden.
 *
 * Gebruik:  npm run proef:t4students
 *
 * Het schriftje weigert te starten als de werkboom vuil is, en herstelt elk
 * gewijzigd bestand uit het geheugen, dus zonder git-ingrepen.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORTEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOETS_BEREIK = "tests/t4students-bereikbaarheid.test.ts";
const TOETS_LEVEND = "tests/t4students-live-weg.test.ts";
const TOETS_POORT = "tests/t4students-uitstuurcontrole.test.ts";
const TOETS_BULK = "tests/t4students-uitstuur-bulk.test.ts";

/** Elke mutatie: bestand, exacte tekst die vervangen wordt, en de vervanging. */
const MUTATIES = [
  {
    code: "M1",
    omschrijving: "vragenlijstroute uitgezet met commentaar",
    toets: TOETS_BEREIK,
    bestand: "server/routes.ts",
    van: "registerVragenlijstT4StudentsRoutes(app);",
    naar: "// registerVragenlijstT4StudentsRoutes(app);",
  },
  {
    code: "M1b",
    omschrijving: "regel van de vragenlijstroute volledig weggehaald",
    toets: TOETS_BEREIK,
    bestand: "server/routes.ts",
    van: "  registerVragenlijstT4StudentsRoutes(app);\n",
    naar: "",
  },
  {
    code: "M2",
    omschrijving: "deel 1 stuurt niet meer door naar het studiekompas",
    toets: TOETS_BEREIK,
    bestand: "client/src/pages/deel1.tsx",
    van: "navigate(`/afname/${id}/studiekompas`",
    naar: "navigate(`/afname/${id}/deel2`",
  },
  {
    code: "M3",
    omschrijving: "invulscherm haalt weer de lijst van een ander instrument op",
    toets: TOETS_BEREIK,
    bestand: "client/src/pages/studiekompas.tsx",
    van: "/api/vragenlijst/tapas-t4students",
    naar: "/api/instrument",
    alleVoorkomens: true,
  },
  {
    code: "M6",
    omschrijving: "doorsturing naar het studiekompas uitgezet met commentaar",
    toets: TOETS_BEREIK,
    bestand: "client/src/pages/deel1.tsx",
    van: "navigate(`/afname/${id}/studiekompas`",
    naar: "// navigate(`/afname/${id}/studiekompas`",
  },
  {
    code: "M7",
    omschrijving: "adres van het invulscherm gewijzigd in App.tsx",
    toets: TOETS_BEREIK,
    bestand: "client/src/App.tsx",
    van: '"/afname/:id/studiekompas"',
    naar: '"/afname/:id/studiekompas-oud"',
  },
  {
    code: "M4",
    omschrijving: "vragenlijstroute levert bloksleutels in plaats van item-id's",
    toets: TOETS_LEVEND,
    bestand: "server/routes/vragenlijst-t4students.ts",
    van: "id: item.id,",
    naar: "id: `B${index}`,",
    extra: (tekst) => tekst.replace(".map((item: T4SItem) =>", ".map((item: T4SItem, index: number) =>"),
  },
  {
    code: "M5",
    omschrijving: "serverzijdige weigering van onvolledige inzendingen uitgezet",
    toets: TOETS_LEVEND,
    bestand: "server/volledigheid-afname.ts",
    van: 'if (instrumentId === "t4students") return true;',
    naar: 'if (instrumentId === "t4students") return false;',
  },
  {
    code: "M8",
    omschrijving: "uitstuurpoort weggehaald bij de zelfstart en de uitnodiging",
    toets: TOETS_POORT,
    bestand: "server/routes/afnames.ts",
    van: "await poortVoorUitstuur(",
    naar: "await geenPoort(",
    alleVoorkomens: true,
    extra: (tekst) =>
      tekst.replace(
        'import { poortVoorUitstuur } from "../t4students/uitstuurcontrole";',
        "const geenPoort = async () => null;",
      ),
  },
  {
    code: "M9",
    omschrijving: "uitstuurpoort weggehaald bij de bulk-import",
    toets: TOETS_BULK,
    bestand: "server/bulk-import/routes.ts",
    van: "await poortVoorUitstuur(instrumentId, app)",
    naar: "null",
  },
  {
    code: "M10",
    omschrijving: "uitstuurpoort keurt alles goed zonder de keten na te kijken",
    toets: TOETS_POORT,
    bestand: "server/t4students/uitstuurcontrole.ts",
    van: 'if (instrumentId !== "t4students") return null;',
    naar: "return null;",
  },
  {
    code: "M11",
    omschrijving: "uitstuurcontrole slaat de controle op de uitgeleverde frontend over",
    toets: TOETS_POORT,
    bestand: "server/t4students/uitstuurcontrole.ts",
    van: "for (const b of bundelBevindingen(wortel)) bevindingen.push(b);",
    naar: "void bundelBevindingen;",
  },
  {
    code: "M12",
    omschrijving: "uitstuurcontrole kijkt maar een taal na in plaats van alle drie",
    toets: TOETS_POORT,
    bestand: "server/t4students/uitstuurcontrole.ts",
    van: 'const TALEN = ["nl", "fr", "en"] as const;',
    naar: 'const TALEN = ["nl"] as const;',
  },
];

function lees(betrekkelijk) {
  return fs.readFileSync(path.join(WORTEL, betrekkelijk), "utf8");
}
function schrijf(betrekkelijk, inhoud) {
  fs.writeFileSync(path.join(WORTEL, betrekkelijk), inhoud);
}

/** Draait een wachttoets. Geeft true terug als de toets rood staat. */
function draaiToets(toets) {
  const uit = spawnSync("npx", ["vitest", "run", toets, "--reporter=dot"], {
    cwd: WORTEL,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
  });
  const tekst = `${uit.stdout ?? ""}${uit.stderr ?? ""}`;
  const rood = /\d+ failed/.test(tekst) || uit.status !== 0;
  const regel = (tekst.match(/Tests {2}.*/g) ?? []).slice(-1)[0] ?? "";
  return { rood, regel: regel.trim(), tekst };
}

function werkboomIsSchoon() {
  const uit = execFileSync("git", ["status", "--porcelain"], { cwd: WORTEL, encoding: "utf8" });
  return uit
    .split("\n")
    .filter(Boolean)
    .filter((r) => !r.startsWith("??")).length === 0;
}

// ------------------------------------------------------------------ uitvoering
if (!werkboomIsSchoon()) {
  console.error("De werkboom bevat nog niet vastgelegde wijzigingen. Leg die eerst vast of zet ze terug.");
  process.exit(2);
}

const uitslagen = [];
console.log("Mutatieproef T4Students\n");

// nulmeting: niets gewijzigd, beide wachttoetsen horen groen te staan
for (const toets of [TOETS_BEREIK, TOETS_LEVEND, TOETS_POORT, TOETS_BULK]) {
  const r = draaiToets(toets);
  uitslagen.push({
    code: "M0",
    omschrijving: `nulmeting op ${path.basename(toets)}`,
    goed: !r.rood,
    uitkomst: r.rood ? "ROOD terwijl er niets gewijzigd is" : "groen, zoals het hoort",
    regel: r.regel,
  });
  console.log(`M0  ${path.basename(toets)}  ${r.rood ? "ROOD (fout)" : "groen"}`);
}

for (const m of MUTATIES) {
  const oorspronkelijk = lees(m.bestand);
  if (!oorspronkelijk.includes(m.van)) {
    uitslagen.push({
      code: m.code,
      omschrijving: m.omschrijving,
      goed: false,
      uitkomst: `ankertekst niet gevonden in ${m.bestand}, de proef kon niet uitgevoerd worden`,
      regel: "",
    });
    console.log(`${m.code.padEnd(4)}anker niet gevonden in ${m.bestand}`);
    continue;
  }
  let gemuteerd = m.alleVoorkomens
    ? oorspronkelijk.split(m.van).join(m.naar)
    : oorspronkelijk.replace(m.van, m.naar);
  if (m.extra) gemuteerd = m.extra(gemuteerd);
  schrijf(m.bestand, gemuteerd);
  const r = draaiToets(m.toets);
  schrijf(m.bestand, oorspronkelijk);
  uitslagen.push({
    code: m.code,
    omschrijving: m.omschrijving,
    goed: r.rood,
    uitkomst: r.rood ? "betrapt" : "GEMIST, de bewaking is hier lek",
    regel: r.regel,
  });
  console.log(`${m.code.padEnd(4)}${m.omschrijving}\n    ${r.rood ? "betrapt" : "GEMIST, de bewaking is hier lek"}`);
}

if (!werkboomIsSchoon()) {
  console.error("\nLet op: de werkboom is na de proef niet schoon. Kijk na met git status.");
}

const gemist = uitslagen.filter((u) => !u.goed);
console.log(`\n${uitslagen.length - gemist.length} van de ${uitslagen.length} rondes zoals verwacht.`);
if (gemist.length > 0) {
  console.log("\nNiet in orde:");
  gemist.forEach((u) => console.log(`  ${u.code} ${u.omschrijving}: ${u.uitkomst}`));
  console.log("\nNiet vrijgeven zolang dit openstaat.");
  process.exit(1);
}
console.log("Elke mutatie wordt betrapt. De bewaking van de T4Students-keten sluit.");
