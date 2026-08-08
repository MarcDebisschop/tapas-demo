import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bouwDossierAdres,
  brilStrookTekst,
  heeftIndruk,
} from "@/lib/regiekamer-bril";

const wortel = resolve(__dirname, "..");
const lees = (pad: string) => readFileSync(resolve(wortel, pad), "utf8");

const schermBron = lees("client/src/pages/traject-scherm.tsx");
const paneelBron = lees("client/src/pages/regiekamer-personen.tsx");

/** Het stuk broncode van de strook, om erin te kunnen kijken. */
function strookBlok(): string {
  const start = schermBron.indexOf('data-testid="bril-strook"');
  expect(start).toBeGreaterThan(-1);
  return schermBron.slice(start, start + 1400);
}

describe("het adres waarmee het scherm door de ogen van iemand anders kijkt", () => {
  it("vraagt zonder bril het gewone dossier op", () => {
    expect(bouwDossierAdres("1", null)).toBe("/api/traject/trajecten/1");
  });

  it("zet met bril op het nummer van de mens in de vraag", () => {
    expect(bouwDossierAdres("1", 11)).toBe(
      "/api/traject/trajecten/1?alsPersoon=11",
    );
    expect(bouwDossierAdres("7", 3)).toBe(
      "/api/traject/trajecten/7?alsPersoon=3",
    );
  });
});

describe("de strook boven het scherm", () => {
  it("zegt door wiens ogen er gekeken wordt", () => {
    expect(brilStrookTekst("Lina Mertens")).toContain("Lina Mertens");
    expect(brilStrookTekst("Lina Mertens")).toContain("door de ogen van");
  });

  it("staat bovenaan in het midden en verschijnt op het merkteken van de server", () => {
    expect(schermBron).toContain("persoonNaam: string");
    expect(schermBron).toContain("gegevens.bril");
    const strook = strookBlok();
    expect(strook).toContain("fixed");
    expect(strook).toContain("left-1/2");
  });

  it("is niet weg te klikken en heeft alleen een knop om terug te gaan", () => {
    const strook = strookBlok();
    expect(strook).toContain("Terug naar mijn eigen zicht");
    expect(strook).not.toMatch(/Sluit/);
    expect(strook).not.toMatch(/aria-label="Verberg/);
    expect(strook).not.toMatch(/<X /);
  });

  it("geeft het hele scherm een rand zolang de bril op staat", () => {
    expect(schermBron).toContain('data-testid="bril-rand"');
  });

  it("bewaart de bril niet tussen twee bezoeken", () => {
    expect(schermBron).not.toContain("localStorage");
    expect(schermBron).not.toContain("sessionStorage");
    expect(paneelBron).not.toContain("localStorage");
    expect(paneelBron).not.toContain("sessionStorage");
  });

  it("heeft een schakelaar in de bovenbalk die om een mens vraagt", () => {
    expect(schermBron).toContain('data-testid="bril-schakelaar"');
    expect(schermBron).toContain('data-testid="bril-keuze"');
  });
});

describe("een gebeurtenis zonder indruk", () => {
  it("herkent een ontbrekende indruk zonder te breken", () => {
    expect(heeftIndruk({})).toBe(false);
    expect(heeftIndruk({ indruk: undefined })).toBe(false);
    expect(heeftIndruk({ indruk: "" })).toBe(false);
    expect(heeftIndruk({ indruk: "   " })).toBe(false);
    expect(heeftIndruk({ indruk: "Het gesprek liep rustig." })).toBe(true);
  });

  it("laat het stuk over de indruk gewoon weg in plaats van een lege plek te tonen", () => {
    expect(schermBron).toContain("indruk?: string");
    expect(schermBron).toContain("heeftIndruk(gebeurtenis)");
    expect(schermBron).not.toContain("gebeurtenis.indruk!");
    expect(schermBron).not.toContain("Geen indruk");
    expect(schermBron).not.toContain("Indruk onbekend");
  });
});
