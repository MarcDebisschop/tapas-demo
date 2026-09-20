// ---------------------------------------------------------------------------
// tests/static-links.test.ts  -  NIEUW BESTAND
//
// AANLEIDING. De uitnodigingslinks in de post dragen geen hekje meer, want een
// deelnemer verloor het laatste stuk van zijn link en kwam op een foutpagina.
// Daarmee rust de hele post op de doorstuurregel van server/kale-paden.ts: een
// kaal pad hoort achter het hekje, en de zoekreeks hoort VOOR het hekje te
// blijven staan, want de 2MINSCAN leest zijn token uit location.search.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { doorstuurDoel } from "../server/kale-paden";

describe("doorstuurDoel", () => {
  it("stuurt de deelnemerslink naar zijn plaats achter het hekje", () => {
    expect(doorstuurDoel("/deelnemer/abc123")).toBe("/#/deelnemer/abc123");
  });

  it("stuurt de teamscanlink en het dashboard mee", () => {
    expect(doorstuurDoel("/teamscan/r/abc123")).toBe("/#/teamscan/r/abc123");
    expect(doorstuurDoel("/dashboard/abc123")).toBe("/#/dashboard/abc123");
  });

  it("houdt de zoekreeks voor het hekje", () => {
    expect(doorstuurDoel("/2minscan", "?uitnodiging=abc123")).toBe(
      "/?uitnodiging=abc123#/2minscan",
    );
  });

  it("zet de korte link van de 2MINSCAN om in de volledige vorm", () => {
    expect(doorstuurDoel("/s/abc123")).toBe("/?uitnodiging=abc123#/2minscan");
    expect(doorstuurDoel("/s/abc123/")).toBe("/?uitnodiging=abc123#/2minscan");
  });

  it("laat de api, de assets, echte bestanden en de startpagina ongemoeid", () => {
    expect(doorstuurDoel("/api/gezondheid")).toBe(null);
    expect(doorstuurDoel("/assets/index-abc.js")).toBe(null);
    expect(doorstuurDoel("/toegang.html", "?t=abc")).toBe(null);
    expect(doorstuurDoel("/")).toBe(null);
  });
});
