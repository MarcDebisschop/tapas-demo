// Temperamentenwiel — bronwaarheidstest.
//
// Waakt over drie dingen die niet mogen schuiven:
//   1. de 24 posities met elk een eigen kleurvolgorde (geen vlakke kwadranten);
//   2. de wielposities en MBTI-equivalenten blijven gelijk aan de bron
//      client/src/twominscan/profielen.ts;
//   3. de teamdynamiek-analyse is deterministisch.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { POSITIES, positieByWielpositie } from "@/temperamentenwiel/posities";
import { analyseerTeam, sectorLabel } from "@/temperamentenwiel/dynamiek";

const TEAM = [
  { naam: "Deelnemer Een", initialen: "D1", wielpositie: "26-46" },
  { naam: "Deelnemer Twee", initialen: "D2", wielpositie: "29-49" },
  { naam: "Deelnemer Drie", initialen: "D3", wielpositie: "22-42" },
  { naam: "Deelnemer Vier", initialen: "D4", wielpositie: "35-55" },
  { naam: "Deelnemer Vijf", initialen: "D5", wielpositie: "128-148" },
  { naam: "Deelnemer Zes", initialen: "D6", wielpositie: "33-53" },
];

describe("Temperamentenwiel — posities", () => {
  it("heeft 24 posities met elk vier kleuren", () => {
    expect(POSITIES).toHaveLength(24);
    for (const p of POSITIES) {
      expect(p.volgorde).toHaveLength(4);
      expect(new Set(p.volgorde).size).toBe(4);
    }
  });

  it("heeft op elke positie een eigen kleurvolgorde", () => {
    const volgordes = new Set(POSITIES.map((p) => p.volgorde.join("-")));
    expect(volgordes.size).toBe(24);
  });

  it("vindt een positie via het volledige paar en via één helft", () => {
    const paar = positieByWielpositie("26-46");
    expect(paar?.acroniem).toBe("Rg N-a");
    expect(positieByWielpositie("46")).toBe(paar);
    expect(positieByWielpositie("999")).toBeNull();
  });

  it("volgt profielen.ts voor wielpositie en MBTI", () => {
    const bron = readFileSync(
      path.resolve(__dirname, "../client/src/twominscan/profielen.ts"),
      "utf8",
    );
    const rijen = [...bron.matchAll(/wielpositie: "([^"]+)",\s*mbti: "([^"]+)"/g)].map((m) => ({
      wielpositie: m[1],
      mbti: m[2] === "géén" ? null : m[2],
    }));
    expect(rijen).toHaveLength(24);
    for (const rij of rijen) {
      const positie = POSITIES.find((p) => p.wielpositie === rij.wielpositie);
      expect(positie, `wielpositie ${rij.wielpositie} ontbreekt`).toBeDefined();
      expect(positie?.mbti).toBe(rij.mbti);
    }
  });

  it("noemt een meng-positie een overgang tussen twee sectoren", () => {
    expect(sectorLabel(positieByWielpositie("128-148")!)).toBe("4-5 · overgang");
    expect(sectorLabel(positieByWielpositie("26-46")!)).toContain("Toekomstgericht leiderschap");
  });
});

describe("Temperamentenwiel — teamdynamiek", () => {
  it("geeft null zonder bruikbare deelnemers", () => {
    expect(analyseerTeam([])).toBeNull();
    expect(analyseerTeam([{ naam: "X", initialen: "X", wielpositie: "999" }])).toBeNull();
  });

  it("rekent spreiding, kleurdekking en energiekost uit", () => {
    const a = analyseerTeam(TEAM)!;
    expect(a.n).toBe(6);
    expect(a.gedektKleuren).toBe(4);
    expect(a.bezetteSectoren).toBe(5);
    expect(a.gemAfstand).toBe(103);
    expect(a.maxAfstand).toBe(165);
    expect(a.kostKleur).toBe("rood");
    expect(a.inzichten.map((i) => i.soort)).toContain("wrijving");
    expect(a.afspraken.length).toBeGreaterThan(0);
  });

  it("is deterministisch", () => {
    expect(JSON.stringify(analyseerTeam(TEAM))).toBe(JSON.stringify(analyseerTeam(TEAM)));
  });

  it("gebruikt energietaal zonder talent- of beoordelingsclaims", () => {
    const tekst = analyseerTeam(TEAM)!
      .inzichten.map((i) => `${i.titel} ${i.tekst}`)
      .concat(analyseerTeam(TEAM)!.afspraken)
      .join(" ")
      .toLowerCase();
    for (const verboden of ["talent", "potentieel", "competentie", "creativiteit", "diagnose", "geschikt"]) {
      expect(tekst).not.toContain(verboden);
    }
  });
});
