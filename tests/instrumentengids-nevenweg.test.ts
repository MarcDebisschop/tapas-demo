// =============================================================================
// tests/instrumentengids-nevenweg.test.ts
// -----------------------------------------------------------------------------
// Waarom deze test bestaat
//   Het teamwiel van de 2MinScan bestond maanden zonder ingang: de pagina stond
//   in App.tsx op /2minscan/teamwiel, maar geen enkele kaart, knop of menu
//   verwees ernaar. Wie het niet uit het hoofd kende, vond het niet. Sinds de
//   2MinScan-kaart een knop "Maak een teamwiel" heeft, ligt die weg vast in
//   client/src/data/instrumentengids.ts.
//
//   Deze test bewaakt twee dingen die stil kunnen wegvallen:
//     1. de knop staat er nog (het veld `nevenweg` bestaat bij de 2MinScan);
//     2. de route waar hij naartoe wijst bestaat ook echt in App.tsx.
//   Een knop naar een route die niemand meer registreert, is erger dan geen
//   knop: hij belooft iets en levert een leeg scherm.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { INSTRUMENTENGIDS } from "../client/src/data/instrumentengids";

const APP = readFileSync(
  path.join(process.cwd(), "client", "src", "App.tsx"),
  "utf-8",
);

describe("nevenwegen in de instrumentengids", () => {
  it("de 2MinScan-kaart heeft een knop naar het teamwiel", () => {
    const tms = INSTRUMENTENGIDS.find((i) => i.id === "twominscan");
    expect(tms).toBeDefined();
    expect(tms!.nevenweg).toBeDefined();
    expect(tms!.nevenweg!.route).toBe("/2minscan/teamwiel");
    expect(tms!.nevenweg!.label.trim().length).toBeGreaterThan(0);
  });

  it("elke nevenweg wijst naar een route die App.tsx registreert", () => {
    const metWeg = INSTRUMENTENGIDS.filter((i) => i.nevenweg);
    expect(metWeg.length).toBeGreaterThan(0);
    for (const instr of metWeg) {
      expect(
        APP.includes(`path="${instr.nevenweg!.route}"`),
        `route ${instr.nevenweg!.route} van ${instr.id} staat niet in App.tsx`,
      ).toBe(true);
    }
  });
});
