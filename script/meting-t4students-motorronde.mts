// ---------------------------------------------------------------------------
// script/meting-t4students-motorronde.mts
//
// De metingen achter het verslag van de motorronde. Dit script wijzigt niets.
// Het rekent en drukt af, zodat elk getal in het verslag na te rekenen is:
//
//   npx tsx script/meting-t4students-motorronde.mts
//
// Wat het meet:
//   1. De lengte van de vragenlijst en het aantal energie-ankers.
//   2. Hoe vaak constructen als gelijk gegroepeerd worden bij tieMargin 1.0
//      en bij 0.3, over een ruime reeks doorgerekende invullingen.
//   3. Wat het gemengde getal combined() nog bepaalt nadat de rangordes op
//      herkenning gaan.
//   4. Het verschil tussen rangschikken op herkenning en op het gemengde getal.
// ---------------------------------------------------------------------------
import { scoreStudiekompas } from "../server/t4students/kompas-scoring.ts";
import { T4STUDENTS_INSTRUMENT as I, t4studentsItems } from "../server/t4students/instrument.ts";

const items = t4studentsItems();
const sm = I.scoringMap;

// ── Een herhaalbare reeks invullingen ──────────────────────────────────────
function trekker(zaad: number) {
  let s = zaad;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const HERKENNING = [0, 1, 2, 3];
const ENERGIE = [-2, -1, 0, 1, 2];

export function invullingen(aantal = 2000): Record<string, any>[] {
  const random = trekker(20260807);
  const reeks: Record<string, any>[] = [{}];
  for (let n = 0; n < aantal; n++) {
    const a: Record<string, any> = {};
    // Hoeveel items deze denkbeeldige deelnemer invult: van bijna niets tot alles.
    const vulgraad = 0.15 + random() * 0.85;
    for (const it of items) {
      if (random() > vulgraad) continue;
      if (it.itemType === "recognition" || it.itemType === "recognition+energy") {
        const antw: Record<string, number> = {
          recognition: HERKENNING[Math.floor(random() * 4)]!,
        };
        if (it.itemType === "recognition+energy") {
          antw.energy = ENERGIE[Math.floor(random() * 5)]!;
        }
        a[it.id] = antw;
      } else if (it.itemType === "sjt" || it.itemType === "choice") {
        const opts = it.options ?? [];
        if (opts.length) a[it.id] = { choice: opts[Math.floor(random() * opts.length)]!.key };
      } else if (it.itemType === "interest") {
        a[it.id] = { interest: HERKENNING[Math.floor(random() * 4)]! };
      } else if (it.itemType === "slider") {
        a[it.id] = { value: Math.floor(random() * 11) };
      }
    }
    reeks.push(a);
  }
  return reeks;
}

function print(kop: string) {
  console.log("\n=== " + kop + " " + "=".repeat(Math.max(0, 60 - kop.length)));
}

// ── 1. Lengte van de vragenlijst ───────────────────────────────────────────
print("1. lengte van de vragenlijst");
console.log("aantal items in sectie main:", items.length);
const perType: Record<string, number> = {};
for (const it of items) perType[it.itemType ?? "?"] = (perType[it.itemType ?? "?"] ?? 0) + 1;
console.log("per itemtype:", perType);
console.log("aantal energie-ankers (scoringMap.energyItems):", sm.energyItems.length);
const zonderAnker = I.families
  .flatMap((f) => f.constructs.map((c) => [f.id, c] as const))
  .filter(([, c]) => !sm.energyItems.some((id) => items.find((i) => i.id === id)?.construct === c));
console.log("constructen zonder energie-anker:", zonderAnker.map(([f, c]) => `${f}/${c}`));

// ── 2. Gelijke stand bij 1.0 en bij 0.3 ────────────────────────────────────
print("2. gelijke stand: hoe vaak worden constructen samen gegroepeerd");

/** Groepeer zoals de motor het doet, maar met een opgegeven marge. */
function groepeer(sorted: string[], scoreOf: (c: string) => number, marge: number): string[][] {
  const groepen: string[][] = [];
  let huidig: string[] = [];
  for (const kandidaat of sorted) {
    if (huidig.length === 0) {
      huidig.push(kandidaat);
      continue;
    }
    const vorige = huidig[huidig.length - 1]!;
    if (Math.abs(scoreOf(vorige) - scoreOf(kandidaat)) <= marge) huidig.push(kandidaat);
    else {
      groepen.push(huidig);
      huidig = [kandidaat];
    }
  }
  if (huidig.length) groepen.push(huidig);
  return groepen;
}

const reeks = invullingen();
const families: [string, (r: any) => Record<string, number>][] = [
  ["Talent-foci", (r) => r.foci.scores],
  ["Talent-versnellers", (r) => r.versnellers.scores],
  ["Interesse", (r) => r.interesse.scores],
];

for (const marge of [1.0, 0.3]) {
  let kopgroepenMetGedeelde = 0;
  let kopgroepGrootteSom = 0;
  let aantalGroepenSom = 0;
  let metingen = 0;
  for (const a of reeks) {
    const r: any = scoreStudiekompas(I, a, null, "nl");
    for (const [, haal] of families) {
      const scores = haal(r);
      const sorted = Object.keys(scores).sort((x, y) => scores[y]! - scores[x]!);
      const g = groepeer(sorted, (c) => scores[c]!, marge);
      metingen++;
      aantalGroepenSom += g.length;
      kopgroepGrootteSom += g[0]!.length;
      if (g[0]!.length > 1) kopgroepenMetGedeelde++;
    }
  }
  console.log(
    `marge ${marge.toFixed(1)}: gedeelde kopgroep in ${kopgroepenMetGedeelde} van ${metingen} ` +
      `(${((100 * kopgroepenMetGedeelde) / metingen).toFixed(1)}%), ` +
      `gemiddelde kopgroepgrootte ${(kopgroepGrootteSom / metingen).toFixed(2)}, ` +
      `gemiddeld aantal groepen ${(aantalGroepenSom / metingen).toFixed(2)}`,
  );
}

// Hoeveel PAREN van constructen gelden als gelijk.
for (const marge of [1.0, 0.3]) {
  let gelijk = 0;
  let paren = 0;
  for (const a of reeks) {
    const r: any = scoreStudiekompas(I, a, null, "nl");
    for (const [, haal] of families) {
      const scores = haal(r);
      const sorted = Object.keys(scores).sort((x, y) => scores[y]! - scores[x]!);
      for (let i = 0; i + 1 < sorted.length; i++) {
        paren++;
        if (Math.abs(scores[sorted[i]!]! - scores[sorted[i + 1]!]!) <= marge) gelijk++;
      }
    }
  }
  console.log(
    `marge ${marge.toFixed(1)}: opeenvolgende paren als gelijk beschouwd: ${gelijk} van ${paren} ` +
      `(${((100 * gelijk) / paren).toFixed(1)}%)`,
  );
}

// ── 3. Rangschikken op herkenning tegenover het gemengde getal ─────────────
print("3. rangschikken op herkenning tegenover het gemengde getal");
let anderTop = 0;
let anderVolgorde = 0;
let totaal = 0;
for (const a of reeks) {
  const r: any = scoreStudiekompas(I, a, null, "nl");
  for (const famId of ["Talent-foci", "Talent-versnellers"]) {
    const cons = I.families.find((f) => f.id === famId)!.constructs;
    const herk: Record<string, number> = {};
    const gemengd: Record<string, number> = {};
    for (const c of cons) {
      herk[c] = r.constructScores[c].recognition;
      gemengd[c] = r.constructScores[c].combined;
    }
    const opHerk = cons.slice().sort((x, y) => herk[y]! - herk[x]!);
    const opGemengd = cons.slice().sort((x, y) => gemengd[y]! - gemengd[x]!);
    totaal++;
    if (opHerk[0] !== opGemengd[0]) anderTop++;
    if (opHerk.join("|") !== opGemengd.join("|")) anderVolgorde++;
  }
}
console.log(
  `van ${totaal} rangordes wijst het gemengde getal in ${anderTop} gevallen een andere nummer een aan ` +
    `(${((100 * anderTop) / totaal).toFixed(1)}%), en in ${anderVolgorde} gevallen een andere volgorde ` +
    `(${((100 * anderVolgorde) / totaal).toFixed(1)}%)`,
);

// ── 4. Waarvoor dient het gemengde getal nog ───────────────────────────────
print("4. leeg tegenover neutraal bij energie");
const leeg: any = scoreStudiekompas(I, {}, null, "nl");
const neutraal: any = scoreStudiekompas(I, { V1: { recognition: 2, energy: 0 } }, null, "nl");
console.log("lege invulling, avgEnergy van Analyse:", leeg.constructScores["Analyse"].avgEnergy);
console.log(
  "energie uitdrukkelijk op nul, avgEnergy van Analyse:",
  neutraal.constructScores["Analyse"].avgEnergy,
);
console.log("lege invulling, balanslabel van Analyse:", leeg.versnellers.balanslabels["Analyse"]);
console.log(
  "energie uitdrukkelijk op nul, balanslabel van Analyse:",
  neutraal.versnellers.balanslabels["Analyse"],
);
