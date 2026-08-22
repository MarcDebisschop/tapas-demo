/**
 * Het blad "Vertaling naar gevestigde kaders" plaatst het T4P-profiel naast Big
 * Five, RIASEC en Jaques. Dat blad mag geen normatieve niveaulabels dragen, geen
 * literatuurcorrelaties op de persoon plakken en niet naar selectie verwijzen.
 * Deze test houdt die grens vast, ook wanneer de tekst later wordt herschreven.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bron = readFileSync(
  resolve(__dirname, "..", "server/t4p/kompas-contract.ts"),
  "utf8",
);

describe("Vertaalblad naar gevestigde kaders", () => {
  it("gebruikt geen normatieve niveaulabels voor de Big-Five-dimensies", () => {
    const start = bron.indexOf("function bigFiveIndicatie");
    const eind = bron.indexOf("}", bron.indexOf("return", start));
    const functie = bron.slice(start, eind);
    for (const verboden of ["Zeer hoog", "Hoog", "Midden", "Laag", "Gemiddeld"]) {
      expect(functie).not.toContain(`"${verboden}`);
    }
    expect(functie).toContain("in dit profiel");
  });

  it("plakt geen correlatiecoëfficiënten uit de literatuur op de persoon", () => {
    expect(bron).not.toContain("r≈");
  });

  it("noemt selectie alleen als uitgesloten gebruik", () => {
    expect(bron).toContain("Niet voor selectie of enige geschiktheidsbeslissing.");
    expect(bron).not.toContain("HR, selectie en organisatieontwerp");
  });

  it("noemt de koppelingen bruggen en geen gevalideerde equivalenties", () => {
    expect(bron).toContain("interpretatieve bruggen");
    expect(bron).toContain("Geen van deze ");
    expect(bron).not.toContain("onderbouwde equivalenties");
  });
});

describe("RIASEC-kolom op het vertaalblad", () => {
  it("benoemt een rangorde binnen het profiel en geen niveau", () => {
    const start = bron.indexOf("const RIASEC_INDICATIE = [");
    const blok = bron.slice(start, bron.indexOf("];", start));
    expect(blok).toContain("1e oriëntatie");
    for (const verboden of ["Sterk", "Midden", "Laag"]) {
      expect(blok).not.toContain(verboden);
    }
  });
});
