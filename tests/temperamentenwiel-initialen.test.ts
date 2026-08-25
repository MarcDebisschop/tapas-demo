// Temperamentenwiel — één initialenregel voor wiel en teamwiel.
//
// Waarom deze test bestaat: de initialen stonden eerder op twee plaatsen in de
// code, waardoor dezelfde persoon in het individuele rapport andere letters
// kreeg dan op het teamwiel ("Naima El Amrani" werd NE in het ene en NA in het
// andere). Deze test houdt die regel op één plaats en legt vast wat ze doet.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { initialenVan } from "@/temperamentenwiel/initialen";

describe("initialenVan", () => {
  it("neemt voornaam en familienaam", () => {
    expect(initialenVan("Tom Peeters")).toBe("TP");
    expect(initialenVan("Ilse Verhoeven")).toBe("IV");
    expect(initialenVan("Lore Janssens")).toBe("LJ");
  });

  it("slaat tussenvoegsels en lidwoorden over", () => {
    expect(initialenVan("Bram De Cock")).toBe("BC");
    expect(initialenVan("Naima El Amrani")).toBe("NA");
    expect(initialenVan("Jan van der Velde")).toBe("JV");
    expect(initialenVan("Marc Debisschop")).toBe("MD");
  });

  it("valt bij één naamdeel terug op de eerste twee letters", () => {
    expect(initialenVan("Ilse")).toBe("IL");
    expect(initialenVan("Bo")).toBe("BO");
  });

  it("werkt met koppelnamen en punten", () => {
    expect(initialenVan("Jason-Louise Vermeersch")).toBe("JV");
    expect(initialenVan("A. Bogaerts")).toBe("AB");
  });

  it("geeft nooit een lege of te lange waarde", () => {
    expect(initialenVan("")).toBe("IK");
    expect(initialenVan("   ")).toBe("IK");
    // Enkel tussenvoegsels: dan zijn die de enige letters die er zijn.
    expect(initialenVan("van der")).toBe("VD");
    for (const naam of ["Tom Peeters", "Naima El Amrani", "", "X"]) {
      const uit = initialenVan(naam);
      expect(uit.length).toBeGreaterThan(0);
      expect(uit.length).toBeLessThanOrEqual(2);
    }
  });

  it("wordt gebruikt door zowel het individuele rapport als het teamwiel", () => {
    const wortel = path.resolve(__dirname, "..");
    const rapport = readFileSync(path.join(wortel, "client/src/pages/twominscan-rapport.tsx"), "utf8");
    const teamwiel = readFileSync(path.join(wortel, "client/src/pages/twominscan-teamwiel.tsx"), "utf8");
    for (const bestand of [rapport, teamwiel]) {
      expect(bestand).toContain("initialenVan");
      // Geen eigen initialenlogica meer naast de gedeelde regel.
      expect(bestand).not.toContain("deel.charAt(0).toUpperCase()");
    }
  });
});
