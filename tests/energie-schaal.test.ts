// ---------------------------------------------------------------------------
// tests/energie-schaal.test.ts
//
// Vastzetten dat er nog maar EEN knipverdeling op de energieschaal 0 tot 10
// bestaat, dat de driedeling een zuivere afgeleide is van de vierdeling, en dat
// alle plaatsen die energie labelen bij dezelfde score hetzelfde antwoord geven.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENERGIE_GRENZEN,
  ENERGIE_MAX,
  ENERGIE_MIN,
  ENERGIE_TERUGVAL,
  ITEM_ENERGIE_MAX,
  ITEM_ENERGIE_MIN,
  energieBand,
  energieBandDrie,
  energieNaarTienschaal,
  isLageEnergie,
  isPositieveEnergie,
  type EnergieBand,
} from "../shared/energie-schaal";

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf-8");

// Een fijnmazig raster over de hele schaal, zodat een verschoven grens niet
// tussen twee testpunten door kan glippen.
const RASTER: number[] = [];
for (let x = 0; x <= 100; x++) RASTER.push(x / 10);

describe("omzetting van de itemschaal naar de schaal 0 tot 10", () => {
  it("zet de uiteinden en het midden om zoals verwacht", () => {
    expect(energieNaarTienschaal(ITEM_ENERGIE_MIN)).toBe(ENERGIE_MIN);
    expect(energieNaarTienschaal(0)).toBe(5);
    expect(energieNaarTienschaal(ITEM_ENERGIE_MAX)).toBe(ENERGIE_MAX);
  });

  it("rondt af op twee decimalen zoals de scoringsmotor dat doet", () => {
    // round2 in de motor is Number(x.toFixed(2)); dat moet identiek blijven,
    // anders verschuiven bevroren contracten in de laatste decimaal.
    const ruw = ((0.333 + 2) / 4) * 10;
    expect(energieNaarTienschaal(0.333)).toBe(Number(ruw.toFixed(2)));
  });

  it("is monotoon stijgend", () => {
    for (let i = -20; i < 20; i++) {
      expect(energieNaarTienschaal((i + 1) / 10)).toBeGreaterThan(energieNaarTienschaal(i / 10));
    }
  });
});

describe("de canonieke knipverdeling", () => {
  it("gebruikt de grenzen die het T4P-rapport al hanteerde", () => {
    expect(ENERGIE_GRENZEN.hoog).toBe(7.5);
    expect(ENERGIE_GRENZEN.stevig).toBe(5);
    expect(ENERGIE_GRENZEN.wisselend).toBe(3);
  });

  it("plaatst elke score in precies een band, en de grens hoort bij de bovenste band", () => {
    expect(energieBand(ENERGIE_GRENZEN.hoog)).toBe("hoog");
    expect(energieBand(ENERGIE_GRENZEN.hoog - 0.01)).toBe("stevig");
    expect(energieBand(ENERGIE_GRENZEN.stevig)).toBe("stevig");
    expect(energieBand(ENERGIE_GRENZEN.stevig - 0.01)).toBe("wisselend");
    expect(energieBand(ENERGIE_GRENZEN.wisselend)).toBe("wisselend");
    expect(energieBand(ENERGIE_GRENZEN.wisselend - 0.01)).toBe("kwetsbaar");
    expect(energieBand(ENERGIE_MIN)).toBe("kwetsbaar");
    expect(energieBand(ENERGIE_MAX)).toBe("hoog");
  });

  it("is monotoon: een hogere score krijgt nooit een lagere band", () => {
    const rang: Record<EnergieBand, number> = { kwetsbaar: 0, wisselend: 1, stevig: 2, hoog: 3 };
    for (let i = 1; i < RASTER.length; i++) {
      expect(rang[energieBand(RASTER[i])]).toBeGreaterThanOrEqual(rang[energieBand(RASTER[i - 1])]);
    }
  });

  it("gebruikt het midden van de schaal als terugvalwaarde", () => {
    expect(ENERGIE_TERUGVAL).toBe(5);
    expect(ENERGIE_TERUGVAL).toBe((ENERGIE_MIN + ENERGIE_MAX) / 2);
  });
});

describe("de driedeling is een afgeleide en heeft geen eigen getallen", () => {
  it("volgt overal uit de vierdeling", () => {
    const verwacht = (b: EnergieBand) =>
      b === "hoog" ? "hoog" : b === "stevig" ? "midden" : "laag";
    for (const s of RASTER) {
      expect(energieBandDrie(s)).toBe(verwacht(energieBand(s)));
    }
  });

  it("knipt op dezelfde grenzen als de vierdeling", () => {
    expect(energieBandDrie(ENERGIE_GRENZEN.hoog)).toBe("hoog");
    expect(energieBandDrie(ENERGIE_GRENZEN.hoog - 0.01)).toBe("midden");
    expect(energieBandDrie(ENERGIE_GRENZEN.stevig)).toBe("midden");
    expect(energieBandDrie(ENERGIE_GRENZEN.stevig - 0.01)).toBe("laag");
  });

  it("laat lage en positieve energie elkaars tegendeel zijn", () => {
    for (const s of RASTER) {
      expect(isLageEnergie(s)).toBe(!isPositieveEnergie(s));
      expect(isLageEnergie(s)).toBe(energieBandDrie(s) === "laag");
    }
  });
});

describe("alle plaatsen gebruiken dezelfde knipverdeling", () => {
  // De bestanden die vroeger een eigen knipverdeling of een eigen omzetformule
  // hadden. Ze mogen die getallen niet meer zelf bevatten.
  const AANGESLOTEN = [
    "server/rapportgenerator.ts",
    "server/dashboard.ts",
    "server/t4sports/scoring.ts",
    "server/hdd/aggregatie.ts",
    "server/uitleg.ts",
    "server/chat.ts",
    "server/chat-engine.ts",
    "server/scoring.ts",
  ];

  it("haalt de energiefuncties uit het gedeelde bestand", () => {
    for (const p of AANGESLOTEN) {
      expect(lees(p), p).toMatch(/from "(@shared|\.\.\/shared|\.\.\/\.\.\/shared)\/energie-schaal"/);
    }
  });

  it("bevat nergens nog een eigen kopie van de omzetformule", () => {
    for (const p of AANGESLOTEN) {
      expect(lees(p), p).not.toContain("function energyToTenScale");
    }
  });

  it("bevat nergens nog een eigen reeks energiegrenzen op de schaal 0 tot 10", () => {
    // De oude eigen grenzen: dashboard 7,5/6/4,5, T4Sports 7/4,5, HDD 7,0/5,0,
    // uitleg en chat 4,5, chat-engine 6.
    const verboden: Array<[string, RegExp]> = [
      ["server/dashboard.ts", /[<>]=?\s*(7\.5|6|4\.5)\b/],
      ["server/t4sports/scoring.ts", /normalizedQuestionnaireEnergy\s*>=?\s*[0-9]/],
      ["server/hdd/aggregatie.ts", /robust:\s*7\.0|watch:\s*5\.0/],
      ["server/uitleg.ts", /Energie\w*\s*<\s*4\.5|energie\w*\s*<\s*4\.5/],
      ["server/chat.ts", /Energie\w*\s*<\s*4\.5|energie\w*\s*<\s*4\.5/],
      ["server/chat-engine.ts", /energieVragenlijst\s*>=\s*6/],
    ];
    for (const [p, re] of verboden) {
      expect(lees(p), p).not.toMatch(re);
    }
  });

  it("geeft bij dezelfde score in rapport, dashboard en T4Sports hetzelfde antwoord", async () => {
    const { bouwDashboardData } = await import("../server/dashboard");
    for (const score of RASTER) {
      const contract = {
        sections: {
          main: {
            meta: { normalizedQuestionnaireEnergy: score, baselineProfessionalEnergy: score },
            constructRows: [],
          },
        },
      };
      const data = bouwDashboardData(contract, "nl")!;
      // Het dashboard toont eigen woorden, maar wel per canonieke band. Dezelfde
      // band moet altijd hetzelfde woord opleveren en omgekeerd.
      const woordPerBand: Record<EnergieBand, string> = {
        hoog: "hoog",
        stevig: "gezond",
        wisselend: "matig",
        kwetsbaar: "laag",
      };
      expect(data.energie.label, `score ${score}`).toBe(woordPerBand[energieBand(score)]);
    }
  });
});
