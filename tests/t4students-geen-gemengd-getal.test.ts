import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Er is geen gemengd getal meer.
//
// WAT HET WAS
// `combined` telde de herkenning van een construct op bij zijn energie maal
// energyToRecognitionFactor. Het was een mengsel van twee metingen op twee
// verschillende schalen. Zolang het de rangorde stuurde, zakte wie zich sterk
// herkent maar er weinig energie uit haalt onder iemand die zich nauwelijks
// herkent maar het wel plezierig vindt.
//
// WAT ER BESLIST IS
// Het getal gaat volledig weg, uit de motor en uit de uitvoer. Het bepaalde al
// geen volgorde, geen drempel en geen label meer, en een getal dat niets
// bepaalt maar wel in de uitvoer staat nodigt uit om er alsnog op te steunen.
// Rangschikken gebeurt op herkenning, energie wordt apart getoond.
//
// WAT DEZE TEST BEWAAKT
// Dat het veld nergens terugkeert: niet in de motor, niet in de rapportketen,
// en niet in de uitvoer die het rapport te zien krijgt.
// ---------------------------------------------------------------------------

const WORTEL = path.resolve(__dirname, "..");

/**
 * De keten van de scoringsuitvoer naar het papier. Nergens hier hoort het
 * mengsel nog thuis, ook niet als naam.
 */
const RAPPORTKETEN = [
  path.join(WORTEL, "server", "t4students"),
  path.join(WORTEL, "script"),
];

/**
 * Meetscripts lezen de volledige uitvoer om haar te beschrijven. Ze sturen geen
 * uitkomst en stellen geen rapport samen, dus zij mogen het veld noemen.
 */
const GEEN_RAPPORT = /^script[\\/]meting-/;

function bronbestanden(map: string): string[] {
  const uit: string[] = [];
  for (const naam of readdirSync(map)) {
    const p = path.join(map, naam);
    if (statSync(p).isDirectory()) uit.push(...bronbestanden(p));
    else if (/\.(ts|mts)$/.test(naam)) uit.push(p);
  }
  return uit;
}

function zonderCommentaar(bron: string): string {
  return bron.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("er is geen gemengd getal meer", () => {
  it("de uitvoer kent het veld niet", () => {
    const r = scoreStudiekompas(I, { V1: { recognition: 2, energy: 2 } }, null, "nl");
    for (const [con, s] of Object.entries(r.constructScores)) {
      expect(Object.keys(s), `${con} draagt nog een gemengd getal`).toEqual([
        "family",
        "recognition",
        "avgEnergy",
      ]);
    }
  });

  it("de twee metingen staan nog wel apart in de uitvoer", () => {
    // Tegenproef: het mengsel gaat weg, de twee grootheden waaruit het bestond
    // blijven allebei leesbaar. Anders zou dit een verlies aan meting zijn in
    // plaats van het opruimen van een verwarrend tussengetal.
    const r = scoreStudiekompas(I, { V1: { recognition: 2, energy: 2 } }, null, "nl");
    expect(r.constructScores["Analyse"].recognition).toBe(2);
    expect(r.constructScores["Analyse"].avgEnergy).toBe(2);
  });

  it("geen enkel bestand van de rapportketen noemt het veld nog", () => {
    const overtreders: string[] = [];
    for (const map of RAPPORTKETEN) {
      for (const p of bronbestanden(map)) {
        const relatief = path.relative(WORTEL, p);
        if (GEEN_RAPPORT.test(relatief)) continue;
        const regels = zonderCommentaar(readFileSync(p, "utf-8"))
          .split("\n")
          .map((r, i) => ({ nr: i + 1, tekst: r.trim() }))
          .filter((r) => /\bcombined\b|\benergyToRecognitionFactor\b/.test(r.tekst));
        for (const r of regels) overtreders.push(`${relatief}:${r.nr}  ${r.tekst}`);
      }
    }
    expect(
      overtreders,
      "Het gemengde getal is weg en komt niet terug. Rangschik op herkenning " +
        "en toon energie apart.",
    ).toEqual([]);
  });

  it("de constante die het voedde staat niet meer in het instrument", () => {
    const constants = I.scoringMap.constants as Record<string, unknown>;
    expect(Object.keys(constants)).not.toContain("energyToRecognitionFactor");
  });
});
