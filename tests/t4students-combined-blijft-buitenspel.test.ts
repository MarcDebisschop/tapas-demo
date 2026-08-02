import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Het gemengde getal `combined` blijft staan en bepaalt niets.
//
// WAT HET IS
// combined telt de herkenning van een construct op bij zijn energie maal
// energyToRecognitionFactor. Het is een mengsel van twee metingen op twee
// verschillende schalen. Zolang het de rangorde stuurde, zakte wie zich sterk
// herkent maar er weinig energie uit haalt onder iemand die zich nauwelijks
// herkent maar het wel plezierig vindt.
//
// WAT ER BESLIST IS
// Het getal blijft in de uitvoer staan, want er is niets mis met de berekening
// zelf en oude afnames blijven ermee vergelijkbaar. Maar niets mag er nog op
// steunen: niet de rangorde, niet een drempel, niet een label, en niet het
// rapport. Rangschikken gebeurt op herkenning, energie wordt apart getoond.
//
// WAT DEZE TEST BEWAAKT
// tests/t4students-rangschikken-op-herkenning.test.ts leest de scoringsmotor
// zelf na. Die bewaking stopt bij dat ene bestand, en het rapport is een tweede
// plaats waar het mengsel binnen zou kunnen sluipen. Deze test kijkt daarom
// over de volledige rapportketen: geen enkel bestand dat het rapport samenstelt
// of tekent, mag het veld lezen.
// ---------------------------------------------------------------------------

const WORTEL = path.resolve(__dirname, "..");

/**
 * De keten van de scoringsuitvoer naar het papier. Dit zijn de bestanden waar
 * `combined` na de beslissing niets meer te zoeken heeft.
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

/** De drie regels in de motor waar het getal wel hoort: type, definitie, uitvoer. */
const MOTORBESTAND = path.join("server", "t4students", "kompas-scoring.ts");
const MOTORREGELS = [
  "combined: number | null;",
  "function combined(con: string): number | null {",
  "combined: combined(con),",
];

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

describe("het gemengde getal blijft staan en bepaalt niets", () => {
  it("de motor levert het nog altijd", () => {
    const r = scoreStudiekompas(I, { V1: { recognition: 2, energy: 2 } }, null, "nl");
    expect(r.constructScores["Analyse"].combined).toBe(3);
  });

  it("het blijft leeg zodra er geen energie gemeten is", () => {
    const r = scoreStudiekompas(I, { V1: { recognition: 2 } }, null, "nl");
    expect(r.constructScores["Analyse"].combined).toBeNull();
  });

  it("geen enkel bestand van de rapportketen leest het veld", () => {
    const overtreders: string[] = [];
    for (const map of RAPPORTKETEN) {
      for (const p of bronbestanden(map)) {
        const relatief = path.relative(WORTEL, p);
        if (GEEN_RAPPORT.test(relatief)) continue;
        const regels = zonderCommentaar(readFileSync(p, "utf-8"))
          .split("\n")
          .map((r, i) => ({ nr: i + 1, tekst: r.trim() }))
          .filter((r) => /\bcombined\b/.test(r.tekst));
        for (const r of regels) {
          if (relatief === MOTORBESTAND && MOTORREGELS.includes(r.tekst)) continue;
          overtreders.push(`${relatief}:${r.nr}  ${r.tekst}`);
        }
      }
    }
    expect(
      overtreders,
      "Het gemengde getal mag nergens een uitkomst sturen. Rangschik op " +
        "herkenning en toon energie apart.",
    ).toEqual([]);
  });
});
