// ---------------------------------------------------------------------------
// tests/contract-toestemming.test.ts
//
// Ingreep 2 uit de analyse van de vier instrumenttesten: bevinding 2 bij het
// T4P Business Kompas. In het bevroren afnamecontract stond het toestemmingsveld
// hard op `given: true`, ook wanneer het tijdstip leeg was. Een bewijsstuk dat
// toestemming bevestigt zonder tijdstip is zwakker dan het lijkt.
//
// Wat deze tests vastleggen:
//   1. Zonder tijdstip zegt het contract eerlijk dat de toestemming niet
//      vastligt, ook al draagt de afname de vlag.
//   2. Met vlag en tijdstip staat er wel een bevestiging.
//   3. De draagwijdte van de afname gaat voor op de standaard van het
//      instrument, en de standaard vult aan wanneer de afname er geen heeft.
//   4. Oudere contracten en seedgegevens zonder vlag blijven werken: dan telt
//      het tijdstip als het bewijs.
//   5. Geen enkele generator zet het veld nog hard op true.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toestemmingVoorContract } from "../server/contract-toestemming";

const STANDAARD = "profiel-generatie + rapport";

describe("het contract bevestigt toestemming enkel met een tijdstip als onderbouwing", () => {
  it("zegt niet-gegeven wanneer het tijdstip ontbreekt", () => {
    const t = toestemmingVoorContract({
      consentGiven: true,
      consentTimestamp: null,
      standaardScope: STANDAARD,
    });
    expect(t.given).toBe(false);
    expect(t.timestamp).toBeNull();
  });

  it("zegt niet-gegeven wanneer de afname de toestemming niet draagt", () => {
    const t = toestemmingVoorContract({
      consentGiven: false,
      consentTimestamp: "2026-08-19T10:00:00.000Z",
      standaardScope: STANDAARD,
    });
    expect(t.given).toBe(false);
  });

  it("bevestigt met vlag en tijdstip samen", () => {
    const t = toestemmingVoorContract({
      consentGiven: true,
      consentTimestamp: "2026-08-19T10:00:00.000Z",
      standaardScope: STANDAARD,
    });
    expect(t.given).toBe(true);
    expect(t.timestamp).toBe("2026-08-19T10:00:00.000Z");
  });

  it("houdt oudere gegevens zonder vlag leesbaar: het tijdstip is dan het bewijs", () => {
    const t = toestemmingVoorContract({
      consentTimestamp: "2026-01-02T09:00:00.000Z",
      standaardScope: STANDAARD,
    });
    expect(t.given).toBe(true);
  });

  it("neemt de draagwijdte van de afname over en valt anders terug op de standaard", () => {
    expect(
      toestemmingVoorContract({
        consentScope: "eigen draagwijdte",
        consentTimestamp: "2026-08-19T10:00:00.000Z",
        standaardScope: STANDAARD,
      }).scope,
    ).toBe("eigen draagwijdte");
    expect(
      toestemmingVoorContract({
        consentTimestamp: "2026-08-19T10:00:00.000Z",
        standaardScope: STANDAARD,
      }).scope,
    ).toBe(STANDAARD);
  });
});

describe("geen enkele contractgenerator zet het toestemmingsveld nog hard op true", () => {
  const generatoren = [
    "server/scoring.ts",
    "server/t4teens/scoring.ts",
    "server/t4kids/scoring.ts",
    "server/t4students/afnamecontract.ts",
  ];

  for (const pad of generatoren) {
    it(`${pad} gebruikt de gedeelde toestemmingslaag`, () => {
      const bron = readFileSync(join(process.cwd(), pad), "utf8");
      expect(bron).toContain("toestemmingVoorContract");
      // De harde bevestiging mag niet terugkeren bij een latere wijziging.
      expect(bron).not.toMatch(/consent:\s*\{\s*\n\s*given:\s*true/);
    });
  }
});
