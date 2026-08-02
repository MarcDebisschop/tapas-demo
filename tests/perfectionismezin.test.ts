// ---------------------------------------------------------------------------
// In het kindrapport staat een zin over perfectionisme: "Je liet zien dat je
// dingen graag heel goed wil doen." Die zin hoort bij een stelling, niet bij
// vijf. Deze test toont per driverstelling apart welke zin het kind te lezen
// krijgt.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { buildT4KidsContract } from "../server/t4kids/scoring";
import { bouwKruisanalyse } from "../client/src/pages/t4kids/kruisanalyse";
import { T4KIDS_STELLINGEN } from "../server/t4kids/itembank";

const deelnemer = { respondentCode: "TEST-003", name: "Test Kind", keuzes: null };

const PERFECTIONISME = "graag héél goed wil doen";

// De vijf driverstellingen uit de itembank, met de driver die ze meten.
const DRIVERSTELLINGEN = T4KIDS_STELLINGEN.filter((s) => s.soort === "Driver").map((s) => ({
  id: s.id,
  driver: s.mapping,
}));

// Wat het kind te lezen krijgt als het alleen deze ene stelling met "bijna
// altijd" beantwoordt en verder niets invult.
function zinnenBij(stellingId: string): string[] {
  const contract = buildT4KidsContract({ ...deelnemer, responses: { [stellingId]: 3 } });
  return bouwKruisanalyse(contract.sections.rapport.exacteAntwoorden as any, "Test").verwonderlijk;
}

describe("T4Kids - de zin over perfectionisme valt alleen bij de driver die erover gaat", () => {
  it("er zijn vijf driverstellingen, elk met een eigen driver", () => {
    expect(DRIVERSTELLINGEN).toHaveLength(5);
    expect(new Set(DRIVERSTELLINGEN.map((d) => d.driver)).size).toBe(5);
  });

  it("de stelling over netjes en juist werk levert wel de zin over perfectionisme op", () => {
    const bePerfect = DRIVERSTELLINGEN.find((d) => d.driver === "Be Perfect")!;
    expect(zinnenBij(bePerfect.id).join(" ")).toContain(PERFECTIONISME);
  });

  it("de vier andere driverstellingen leveren die zin niet op", () => {
    // Wat het kind merkte: wie aangaf dat het graag anderen blij maakt, of
    // graag snel veel dingen doet, of extra zijn best doet als iemand in hem
    // gelooft, of dingen graag zelf oplost, las evengoed dat het dingen graag
    // heel goed wil doen. Dat stond nergens in zijn antwoorden.
    const verkeerd: string[] = [];
    for (const d of DRIVERSTELLINGEN) {
      if (d.driver === "Be Perfect") continue;
      if (zinnenBij(d.id).join(" ").includes(PERFECTIONISME)) verkeerd.push(`${d.id} (${d.driver})`);
    }
    expect(verkeerd).toEqual([]);
  });

  it("elke driver levert wel een eigen zin op, zodat er geen gesprek verloren gaat", () => {
    const zinnen = DRIVERSTELLINGEN.map((d) => zinnenBij(d.id).join(" "));
    expect(zinnen.every((z) => z.trim().length > 0)).toBe(true);
    expect(new Set(zinnen).size).toBe(5);
  });

  it("een kind dat geen enkele driver duidelijk aangaf, krijgt geen driverzin", () => {
    const contract = buildT4KidsContract({ ...deelnemer, responses: {} });
    const zinnen = bouwKruisanalyse(
      contract.sections.rapport.exacteAntwoorden as any,
      "Test",
    ).verwonderlijk.join(" ");
    expect(zinnen).not.toContain(PERFECTIONISME);
  });
});
