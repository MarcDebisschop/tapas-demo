// ---------------------------------------------------------------------------
// tests/core-is-de-standaard.test.ts
//
// De toepassing start in Tapas Core, met de onthaalpagina als voordeur.
//
// Wat er misging: een keuze voor de belevingslaag werd bewaard in localStorage
// en bleef daar staan, ook na het sluiten van de browser. Wie een keer met de
// schakelaar had gewisseld, kreeg bij elk volgend bezoek de startpagina met de
// poorten in plaats van de onthaalpagina, zonder ergens te kunnen zien waarom.
//
// De regel sinds 16 augustus 2026: de keuze wordt nergens bewaard. De
// belevingslaag is alleen bereikbaar zolang de parameter beleving in het adres
// staat. De schakelaar zet die parameter en haalt hem weer weg.
//
// Wat deze toetsen bewijzen:
//   A. De standaard van de build is Core; er is geen instelling die beleving
//      aanzet.
//   B. De bepaling leest alleen het adres en de env, en bewaart niets.
//   C. De schakelaar zet en wist de parameter.
//   D. Een sleutel uit de oude opzet wordt opgeruimd.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const wortel = resolve(__dirname, "..");
const features = readFileSync(
  resolve(wortel, "client/src/lib/features.ts"),
  "utf-8",
);

describe("A. De standaard van de build is Core", () => {
  it("er staat nergens een instelling die de belevingslaag aanzet", () => {
    // De env-fallback is de enige plek waar een build de belevingslaag aan zou
    // kunnen zetten. Staat VITE_BELEVING nergens op "true", dan is de standaard
    // Core en staat de onthaalpagina op de voordeur.
    const envBestanden = [".env", ".env.production", ".env.local"];
    for (const naam of envBestanden) {
      const pad = resolve(wortel, naam);
      if (!existsSync(pad)) continue;
      const inhoud = readFileSync(pad, "utf-8");
      const regels = inhoud
        .split("\n")
        .filter((r) => r.trim().startsWith("VITE_BELEVING"));
      for (const regel of regels) {
        expect(regel).not.toMatch(/=\s*["']?true["']?\s*$/);
      }
    }
  });

  it("de env-fallback valt terug op Core wanneer er niets gezet is", () => {
    expect(features).toContain('import.meta.env.VITE_BELEVING === "true"');
    expect(features).toMatch(/catch\s*\{\s*return false;/);
  });

  it("Core is het omgekeerde van beleving, en niet andersom afgeleid", () => {
    expect(features).toContain("export const CORE_MODE: boolean = !BELEVING;");
  });
});

describe("B. De keuze wordt nergens bewaard", () => {
  it("de bepaling schrijft niets naar de opslag", () => {
    const begin = features.indexOf("function bepaalBeleving()");
    expect(begin).toBeGreaterThan(-1);
    const eind = features.indexOf("function ruimOudeKeuzeOp()");
    expect(eind).toBeGreaterThan(begin);
    const lichaam = features.slice(begin, eind);
    expect(lichaam).not.toContain("setItem");
    // De opslag wordt binnen de bepaling alleen nog aangeraakt om de oude
    // sleutel op te ruimen, en die opruiming staat in een eigen functie.
    expect(lichaam).not.toContain("getItem");
  });

  it("de bepaling leest het adres en valt daarna terug op de env", () => {
    const begin = features.indexOf("function bepaalBeleving()");
    const eind = features.indexOf("function ruimOudeKeuzeOp()");
    const lichaam = features.slice(begin, eind);
    expect(lichaam).toContain('params.get("beleving")');
    expect(lichaam).toContain("return envBeleving();");
    expect(lichaam.indexOf('params.get("beleving")')).toBeLessThan(
      lichaam.indexOf("return envBeleving();"),
    );
  });

  it("nergens in de toepassing wordt de belevingskeuze nog weggeschreven", () => {
    expect(features).not.toContain(
      'window.localStorage.setItem(OPSLAG_SLEUTEL',
    );
  });
});

describe("C. De schakelaar werkt met de parameter", () => {
  it("aanzetten schrijft de parameter in het adres", () => {
    expect(features).toContain('url.searchParams.set("beleving", "1")');
  });

  it("uitzetten haalt de parameter weg", () => {
    expect(features).toContain('url.searchParams.delete("beleving")');
  });

  it("er volgt altijd een herlaad, zodat de waarde opnieuw bepaald wordt", () => {
    const begin = features.indexOf("export function zetBeleving");
    const lichaam = features.slice(begin);
    expect(lichaam).toContain("window.location.replace(url.toString())");
    expect(lichaam).toContain("window.location.reload()");
  });

  it("bij het terugschakelen blijft de bescherming tegen een 404 staan", () => {
    // Routes die alleen in het volledige platform bestaan, mogen na het
    // uitschakelen niet blijven staan. Die regel is ouder dan deze wijziging en
    // moet blijven werken.
    const begin = features.indexOf("export function zetBeleving");
    const lichaam = features.slice(begin);
    expect(lichaam).toContain("belevingPaden");
    expect(lichaam).toContain('url.hash = "#/"');
  });
});

describe("D. Een sleutel uit de oude opzet wordt opgeruimd", () => {
  it("de opruiming bestaat en wist de sleutel", () => {
    expect(features).toContain("function ruimOudeKeuzeOp(): void");
    expect(features).toContain(
      "window.localStorage.removeItem(OPSLAG_SLEUTEL)",
    );
  });

  it("de opruiming draait bij het bepalen en bij het schakelen", () => {
    const bepaal = features.indexOf("function bepaalBeleving()");
    const zet = features.indexOf("export function zetBeleving");
    const naBepaal = features.slice(bepaal, features.indexOf("function ruimOudeKeuzeOp()"));
    const naZet = features.slice(zet);
    expect(naBepaal).toContain("ruimOudeKeuzeOp();");
    expect(naZet).toContain("ruimOudeKeuzeOp();");
  });
});
